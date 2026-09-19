// src/lib/api/client.ts

export class ApiClientError extends Error {
  status: number;
  errorCode?: string;
  data?: any;

  constructor(status: number, message: string, errorCode?: string, data?: any) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("dynoquizz_token");
  if (!token) {
    const match = document.cookie.match(/(?:^|;\s*)dynoquizz_token=([^;]+)/);
    if (match) {
      token = match[1];
      try {
        localStorage.setItem("dynoquizz_token", token);
      } catch {
        // ignore
      }
    }
  }
  return token;
}

export interface RequestOptions extends RequestInit {
  token?: string | null;
  skipAuth?: boolean;
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { token: customToken, skipAuth = false, headers: customHeaders, ...rest } = options;

  const token = skipAuth ? null : (customToken ?? getAuthToken());

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(customHeaders as Record<string, string>),
  };

  const response = await fetch(url, {
    ...rest,
    headers,
  });

  if (response.ok) {
    // 204 No Content
    if (response.status === 204) {
      return {} as T;
    }
    const text = await response.text();
    if (!text) {
      return {} as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  // Parse standard backend error:
  // { "status": 409, "error": "ATTEMPT_ALREADY_SUBMITTED", "message": "human readable text", "path": "..." }
  let errorJson: any = null;
  try {
    errorJson = await response.json();
  } catch {
    // Not JSON
  }

  const errorCode: string | undefined =
    typeof errorJson?.error === "string" ? errorJson.error : undefined;

  // Show the user message FIRST, then fall back to error code
  const message: string =
    errorJson?.message ||
    errorCode ||
    `Request failed with status ${response.status}`;

  throw new ApiClientError(response.status, message, errorCode, errorJson);
}

export const api = {
  get: <T = any>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: "GET" }),

  post: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(url: string, body?: any, options?: RequestOptions) =>
    apiRequest<T>(url, {
      ...options,
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(url: string, options?: RequestOptions) =>
    apiRequest<T>(url, { ...options, method: "DELETE" }),
};
