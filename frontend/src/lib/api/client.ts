/**
 * Shared frontend API client.
 *
 * The Spring Boot backend is the authority for authentication, authorization,
 * quiz state, attempts, scoring, and results.
 */

export class ApiClientError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly data?: unknown;

  constructor(
    status: number,
    message: string,
    errorCode?: string,
    data?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;
  }
}

/**
 * Read the backend-issued JWT from the frontend session.
 *
 * The frontend never signs or verifies JWTs. It only forwards the token
 * returned by Spring Boot in the Authorization header.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawToken = localStorage.getItem("dynoquizz_token");

  if (!rawToken || rawToken === "undefined" || rawToken === "null") {
    return null;
  }

  const token = rawToken.replace(/^["']|["']$/g, "").trim();

  if (!token || token === "undefined" || token === "null") {
    localStorage.removeItem("dynoquizz_token");
    return null;
  }

  return token;
}

export interface RequestOptions extends RequestInit {
  /**
   * Override the stored backend JWT for this request.
   */
  token?: string | null;

  /**
   * Prevent Authorization from being added.
   */
  skipAuth?: boolean;

  /**
   * Number of network retries for idempotent requests.
   * Mutating requests are never retried automatically.
   */
  retry?: number;

  /**
   * Base delay between safe-request retries.
   */
  retryDelayMs?: number;

  /** Optional in-memory TTL for cache-safe GET requests, in milliseconds. */
  cacheTtlMs?: number;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return null;
  }

  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const looksLikeHtml =
    contentType.toLowerCase().includes("text/html") ||
    /^\\s*<(?:!doctype\\s+html|html|head|body)\\b/i.test(text);

  // API calls should return JSON. Hosting platforms and reverse proxies
  // often return an HTML error page for 404/502/503 responses; never expose
  // that full document as the user-facing error message.
  if (looksLikeHtml) {
    return {
      __unexpectedHtmlResponse: true,
      contentType: contentType || "unknown",
    };
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function normalizeToken(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  const clean = token.replace(/^["']|["']$/g, "").trim();

  if (!clean || clean === "undefined" || clean === "null") {
    return null;
  }

  return clean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


type MemoryGetCacheEntry = {
  expiresAt: number;
  value: unknown;
};

const memoryGetCache = new Map<string, MemoryGetCacheEntry>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
let memoryGetCacheGeneration = 0;

/** Clear cached server data when the authenticated session or data changes. */
export function clearApiCache() {
  memoryGetCacheGeneration += 1;
  memoryGetCache.clear();
  inFlightGetRequests.clear();
}

function cloneApiPayload<T>(value: T): T {
  if (value == null) return value;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

async function apiGetWithMemoryCache<T>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const { cacheTtlMs = 0, ...requestOptions } = options;
  const ttlMs = Math.min(60_000, Math.max(0, Number(cacheTtlMs) || 0));
  const requestOptionsWithMethod: RequestOptions = {
    ...requestOptions,
    method: "GET",
  };

  // Live assessment state, explicit no-store requests, and abortable requests
  // must never share a cached or in-flight response.
  if (
    ttlMs <= 0 ||
    requestOptions.cache === "no-store" ||
    requestOptions.signal
  ) {
    return apiRequest<T>(url, requestOptionsWithMethod);
  }

  const token = requestOptions.skipAuth
    ? null
    : normalizeToken(requestOptions.token ?? getAuthToken());
  const cacheKey = `${token ? `session:${token}` : "anonymous"}|${url}|ttl:${ttlMs}`;
  const now = Date.now();
  const cached = memoryGetCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cloneApiPayload(cached.value as T);
  }
  if (cached) memoryGetCache.delete(cacheKey);

  const existingRequest = inFlightGetRequests.get(cacheKey);
  if (existingRequest) {
    return cloneApiPayload((await existingRequest) as T);
  }

  const generation = memoryGetCacheGeneration;
  const request = apiRequest<T>(url, requestOptionsWithMethod);
  inFlightGetRequests.set(cacheKey, request as Promise<unknown>);

  try {
    const value = await request;
    if (generation === memoryGetCacheGeneration) {
      memoryGetCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        value: cloneApiPayload(value),
      });

      // Bound memory growth in long-lived sessions.
      if (memoryGetCache.size > 40) {
        const currentTime = Date.now();
        for (const [key, entry] of memoryGetCache) {
          if (entry.expiresAt <= currentTime) memoryGetCache.delete(key);
          if (memoryGetCache.size <= 32) break;
        }
        while (memoryGetCache.size > 40) {
          const oldestKey = memoryGetCache.keys().next().value;
          if (oldestKey === undefined) break;
          memoryGetCache.delete(oldestKey);
        }
      }
    }
    return value;
  } finally {
    if (inFlightGetRequests.get(cacheKey) === request) {
      inFlightGetRequests.delete(cacheKey);
    }
  }
}

async function mutateAndInvalidateCache<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } finally {
    // Invalidate even on failed mutations: the server may have committed a
    // change before a proxy/error response reached the browser.
    clearApiCache();
  }
}

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    token: customToken,
    skipAuth = false,
    headers: customHeaders,
    body,
    retry = 0,
    retryDelayMs = 400,
    ...rest
  } = options;

  const token = skipAuth ? null : normalizeToken(customToken ?? getAuthToken());

  const headers = new Headers(customHeaders);

  headers.set("Accept", "application/json");

  if (body !== undefined && body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }

  const method = String(rest.method ?? "GET").toUpperCase();
  const isSafeMethod =
    method === "GET" || method === "HEAD" || method === "OPTIONS";
  const maxRetries = isSafeMethod
    ? Math.max(0, Math.min(3, Math.floor(Number(retry) || 0)))
    : 0;

  let response: Response;

  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetch(url, {
        ...rest,
        body,
        headers,
      });
      break;
    } catch (error) {
      const isAbort =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        String((error as { name?: unknown }).name) === "AbortError";

      if (isAbort || attempt >= maxRetries) {
        const message =
          error instanceof TypeError && /fetch|network/i.test(error.message)
            ? "The browser could not complete the API request. Check network connectivity, NEXT_PUBLIC_API_URL, and the frontend API proxy."
            : error instanceof Error
              ? error.message
              : "Unable to reach the backend server.";

        throw new ApiClientError(0, message);
      }

      await delay(Math.max(150, retryDelayMs) * (attempt + 1));
    }
  }

  const data = await parseResponseBody(response);

  if (
    data &&
    typeof data === "object" &&
    "__unexpectedHtmlResponse" in data
  ) {
    const htmlResponse = data as Record<string, unknown>;
    const contentType =
      typeof htmlResponse.contentType === "string"
        ? htmlResponse.contentType
        : "unknown";

    throw new ApiClientError(
      response.status,
      `The server returned an HTML page instead of JSON (HTTP ${response.status}). Check NEXT_PUBLIC_API_URL and the requested API endpoint.`,
      "UNEXPECTED_HTML_RESPONSE",
      { contentType },
    );
  }

  if (response.ok) {
    return (data ?? {}) as T;
  }

  const errorObject =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  const errorCode =
    typeof errorObject?.code === "string"
      ? errorObject.code
      : typeof errorObject?.error === "string"
        ? errorObject.error
        : undefined;

  const message =
    typeof errorObject?.message === "string"
      ? errorObject.message
      : errorCode ||
        (typeof data === "string" && data.trim()
          ? data
          : `Request failed with status ${response.status}`);

  if (response.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("dynoquizz_token");
    localStorage.removeItem("token");
    clearApiCache();

    document.cookie =
      "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
  }

  throw new ApiClientError(response.status, message, errorCode, data);
}

export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    apiGetWithMemoryCache<T>(url, options),

  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    mutateAndInvalidateCache(
      apiRequest<T>(url, {
        ...options,
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    ),

  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    mutateAndInvalidateCache(
      apiRequest<T>(url, {
        ...options,
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    ),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    mutateAndInvalidateCache(
      apiRequest<T>(url, {
        ...options,
        method: "DELETE",
      }),
    ),
};
