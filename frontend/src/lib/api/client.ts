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

export async function apiRequest<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    token: customToken,
    skipAuth = false,
    headers: customHeaders,
    body,
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

  let response: Response;

  try {
    response = await fetch(url, {
      ...rest,
      body,
      headers,
    });
  } catch (error) {
    const message =
      error instanceof TypeError && /fetch|network/i.test(error.message)
        ? "Quizly backend is unreachable. Start the Spring Boot server and verify NEXT_PUBLIC_API_URL."
        : error instanceof Error
          ? error.message
          : "Unable to reach the backend server.";

    throw new ApiClientError(0, message); 
  }

  const data = await parseResponseBody(response);

  if (response.ok) {
    return (data ?? {}) as T;
  }

  const errorObject =
    data && typeof data === "object" ? (data as Record<string, unknown>) : null;

  const errorCode =
    typeof errorObject?.error === "string" ? errorObject.error : undefined;

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

    document.cookie =
      "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
  }

  throw new ApiClientError(response.status, message, errorCode, data);
}

export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "GET",
    }),

  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "DELETE",
    }),
};
