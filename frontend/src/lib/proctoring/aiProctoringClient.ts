// AI Proctoring Microservice HTTP & WebSocket Client

import { ENDPOINTS } from "@/lib/api/endpoints";

const isDevelopment = process.env.NODE_ENV === "development";

export const AI_PROCTORING_BASE_URL = (
  process.env.NEXT_PUBLIC_AI_PROCTORING_URL?.trim() ||
  (isDevelopment ? "http://localhost:8000" : "")
).replace(/\/+$/, "");

function deriveWebSocketBaseUrl(httpBaseUrl: string): string {
  if (!httpBaseUrl) return "";

  try {
    const url = new URL(httpBaseUrl);
    if (url.protocol === "https:") {
      url.protocol = "wss:";
    } else if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else {
      return "";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

// Allow a separate WebSocket host when required; otherwise derive ws:// or
// wss:// from the configured AI HTTP origin so the two settings cannot drift.
export const AI_PROCTORING_WS_URL = (
  process.env.NEXT_PUBLIC_AI_PROCTORING_WS_URL?.trim() ||
  deriveWebSocketBaseUrl(AI_PROCTORING_BASE_URL)
).replace(/\/+$/, "");

function getAIEndpointConfigurationError(): string | null {
  if (!AI_PROCTORING_BASE_URL) {
    return "NEXT_PUBLIC_AI_PROCTORING_URL is not configured for this deployment.";
  }

  let httpUrl: URL;
  let wsUrl: URL;

  try {
    httpUrl = new URL(AI_PROCTORING_BASE_URL);
    if (httpUrl.protocol !== "http:" && httpUrl.protocol !== "https:") {
      return "NEXT_PUBLIC_AI_PROCTORING_URL must use http:// or https://.";
    }
  } catch {
    return "NEXT_PUBLIC_AI_PROCTORING_URL must be an absolute AI-service URL.";
  }

  try {
    wsUrl = new URL(AI_PROCTORING_WS_URL);
    if (wsUrl.protocol !== "ws:" && wsUrl.protocol !== "wss:") {
      return "NEXT_PUBLIC_AI_PROCTORING_WS_URL must use ws:// or wss://.";
    }
  } catch {
    return "The AI WebSocket URL could not be derived. Configure NEXT_PUBLIC_AI_PROCTORING_WS_URL explicitly.";
  }

  const isLoopbackHost =
    httpUrl.hostname === "localhost" ||
    httpUrl.hostname === "::1" ||
    httpUrl.hostname === "[::1]" ||
    httpUrl.hostname === "127.0.0.1" ||
    httpUrl.hostname.startsWith("127.");

  if (process.env.NODE_ENV === "production" && isLoopbackHost) {
    return "The deployed frontend is pointing to localhost for AI proctoring. Configure NEXT_PUBLIC_AI_PROCTORING_URL with the reachable LAN or deployed AI-service address.";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    httpUrl.protocol !== "https:"
  ) {
    return "This frontend uses HTTPS, so AI proctoring must use an HTTPS URL. Configure NEXT_PUBLIC_AI_PROCTORING_URL with https://.";
  }

  if (
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    wsUrl.protocol !== "wss:"
  ) {
    return "This frontend uses HTTPS, so AI proctoring must use a secure WebSocket. Configure NEXT_PUBLIC_AI_PROCTORING_WS_URL with wss://.";
  }

  return null;
}

export interface AIHealthResponse {
  status: string;
  service: string;
  biometricAvailable: boolean;
  models: {
    yunet: boolean;
    sface: boolean;
    yolo_phone: boolean;
    yolo_person: boolean;
  };
}

export interface StartSessionParams {
  attemptId: number;
  testCode: string;
  referenceImage: string; // base64 JPEG/PNG
  /** Session JWT is sent only as an Authorization header, never in JSON. */
  authToken: string;
}

export interface StartSessionResult {
  sessionId: string;
  wsTicket?: string;
  status: string;
  faceDetected: boolean;
  referenceRegistered: boolean;
  biometricReady: boolean;
  message: string;
}

export interface AnalyzeFramePayload {
  sessionId: string;
  frame?: string; // base64 image
  audio?: number[]; // PCM float samples
  sampleRate?: number;
  ticket?: string;
  authToken?: string;
  studentId?: string;
  attemptId?: number;
  warningCount?: number;
}

export interface TelemetryResponse {
  status: string;
  faceDetected: boolean;
  numFaces: number;
  numPersons: number;
  identityVerified: boolean;
  similarityScore: number;
  gazeDirection: "CENTER" | "LEFT" | "RIGHT" | "UP" | "DOWN";
  yaw: number;
  pitch: number;
  isLookingAway: boolean;
  phoneDetected: boolean;
  micLevel: number;
  voiceActive: boolean;
  loudVoice: boolean;
  warningCount: number;
  malpracticeEvent: string | null;
  eventMessage: string | null;
  autoSubmitted: boolean;
  /** Explicit server decision to block the candidate until identity is restored. */
  identityHold?: boolean;
  /** Server-provided reason such as NO_FACE, MULTIPLE_FACES, or IDENTITY_MISMATCH. */
  identityHoldReason?: string | null;
}

export interface StopSessionParams {
  sessionId: string;
  ticket?: string;
  authToken?: string;
  studentId?: string;
  attemptId?: number;
}

export interface StopSessionResult {
  status: string;
  totalVerifications: number;
  identityMatches: number;
  identityMismatches: number;
  totalWarnings: number;
}

/**
 * Check if the Python AI microservice is online and loaded with biometric models.
 * No fake fallbacks allowed.
 */
export async function checkAIHealth(): Promise<{
  isOnline: boolean;
  biometricReady: boolean;
  backendAvailable?: boolean;
  backendMessage?: string;
  details?: AIHealthResponse;
}> {
  // Catch missing, loopback, and mixed-content URLs before making browser
  // requests. These are deployment configuration errors, not AI model failures.
  const configurationError = getAIEndpointConfigurationError();
  if (configurationError) {
    return {
      isOnline: false,
      biometricReady: false,
      backendMessage: configurationError,
    };
  }

  const [directHealth, backendHealth] = await Promise.all([
    (async () => {
      try {
        const response = await fetch(`${AI_PROCTORING_BASE_URL}/health`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(AI_PROCTORING_BASE_URL.includes(".ngrok-free.dev")
              ? { "ngrok-skip-browser-warning": "true" }
              : {}),
          },
          signal: AbortSignal.timeout(2500),
        });
        if (!response.ok) return null;
        return (await response.json()) as AIHealthResponse;
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        const response = await fetch(ENDPOINTS.proctoring.aiHealth, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        const payload = await response.json().catch(() => null) as {
          reachable?: boolean;
          status?: string;
          biometricAvailable?: boolean;
          models?: Record<string, boolean>;
          message?: string;
        } | null;
        return { ok: response.ok, payload };
      } catch {
        return { ok: false, payload: null };
      }
    })(),
  ]);

  const backendAvailable =
    backendHealth.ok && backendHealth.payload?.reachable === true;
  const backendMessage =
    backendHealth.payload?.message ||
    (backendAvailable
      ? undefined
      : "The quiz backend cannot confirm that its AI proctoring service is reachable.");

  const directIsOnline =
    directHealth?.status === "UP" || directHealth?.status === "DEGRADED";
  const directBiometricReady =
    directHealth?.biometricAvailable === true &&
    directHealth.models?.yunet === true &&
    directHealth.models?.sface === true;
  const backendBiometricReady =
    backendHealth.payload?.biometricAvailable === true &&
    backendHealth.payload.models?.yunet === true &&
    backendHealth.payload.models?.sface === true;

  return {
    isOnline: Boolean(directIsOnline && backendAvailable),
    biometricReady: Boolean(
      directIsOnline &&
      backendAvailable &&
      directBiometricReady &&
      backendBiometricReady,
    ),
    backendAvailable,
    backendMessage,
    ...(directHealth ? { details: directHealth } : {}),
  };
}

/**
 * Registers student reference photo and initializes authoritative AI proctoring session.
 * Strictly throws explicit error if Python AI is offline or reference face registration fails.
 */
export async function startProctoringSession(
  params: StartSessionParams
): Promise<StartSessionResult> {
  const health = await checkAIHealth();
  if (health.backendAvailable === false) {
    throw new Error(
      `BACKEND_UNAVAILABLE: The quiz backend could not confirm AI service readiness. ${health.backendMessage || "Please retry shortly."}`
    );
  }
  if (!health.isOnline) {
    throw new Error(
      `AI_PROCTORING_OFFLINE: The AI Proctoring service is currently unavailable. ${health.backendMessage || "Contact your test administrator."}`
    );
  }
  if (!health.biometricReady) {
    throw new Error(
      "BIOMETRIC_OFFLINE: SFace biometric verification engine is offline. AI Proctoring cannot initialize."
    );
  }

  if (!params.authToken?.trim()) {
    throw new Error("AUTH_REQUIRED: Your session has expired. Please sign in again before starting AI proctoring.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(AI_PROCTORING_BASE_URL.includes(".ngrok-free.dev")
      ? { "ngrok-skip-browser-warning": "true" }
      : {}),
  };
  if (params.authToken) {
    headers["Authorization"] = params.authToken.startsWith("Bearer ")
      ? params.authToken
      : `Bearer ${params.authToken}`;
  }

  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      attemptId: params.attemptId,
      testCode: params.testCode,
      referenceImage: params.referenceImage,
    }),
    // Do not leave the exam lobby stuck forever if the AI service or its
    // backend-access validation stops responding.
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed." }));
    const detail = typeof err.detail === "string" ? err.detail : "";
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AUTHORIZATION_FAILED: ${detail || "Your session is not authorized to start this proctoring session. Sign in again or contact your instructor."}`);
    }
    if (res.status === 503 || /BACKEND_UNAVAILABLE/i.test(detail)) {
      throw new Error(`BACKEND_UNAVAILABLE: The AI proctoring service could not validate your session with the quiz backend. Your assessment remains locked. Please retry shortly. ${detail}`.trim());
    }
    throw new Error(detail || `Proctoring startup failed (HTTP ${res.status}). Please retry or contact your instructor.`);
  }

  const result = (await res.json()) as StartSessionResult;
  if (result.referenceRegistered !== true) {
    throw new Error(
      result.message ||
        "BIOMETRIC_REGISTRATION_FAILED: The server did not confirm reference-photo registration. Retake the photo and try again.",
    );
  }
  if (result.biometricReady !== true || !result.sessionId) {
    throw new Error(
      "BIOMETRIC_REGISTRATION_FAILED: The server did not confirm a ready proctoring session. Retake the photo and try again.",
    );
  }

  return result;
}

/**
 * REST Fallback frame analysis endpoint
 */
export async function analyzeFrameREST(
  payload: AnalyzeFramePayload
): Promise<TelemetryResponse> {
  const { authToken, ...requestPayload } = payload;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    // ngrok's free browser interstitial can otherwise replace API responses with HTML.
    ...(AI_PROCTORING_BASE_URL.includes(".ngrok-free.dev")
      ? { "ngrok-skip-browser-warning": "true" }
      : {}),
  };
  if (authToken) {
    headers["Authorization"] = authToken.startsWith("Bearer ")
      ? authToken
      : `Bearer ${authToken}`;
  }
  if (payload.ticket) {
    headers["X-Proctor-Ticket"] = payload.ticket;
  }

  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/analyze-frame`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestPayload),
    // A stalled inference request must not permanently block REST fallback.
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Frame analysis failed: ${res.statusText}`);
  }

  return (await res.json()) as TelemetryResponse;
}

/**
 * Gracefully stops the AI session and retrieves final counters.
 */
export async function stopProctoringSession(
  params: string | StopSessionParams
): Promise<StopSessionResult | null> {
  try {
    const payload: StopSessionParams =
      typeof params === "string" ? { sessionId: params } : params;

    const { authToken, ...requestPayload } = payload;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Apply the ngrok compatibility header only to requests targeting the AI service.
      ...(AI_PROCTORING_BASE_URL.includes(".ngrok-free.dev")
        ? { "ngrok-skip-browser-warning": "true" }
        : {}),
    };
    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer ")
        ? authToken
        : `Bearer ${authToken}`;
    }
    if (payload.ticket) {
      headers["X-Proctor-Ticket"] = payload.ticket;
    }

    const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/stop`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      return (await res.json()) as StopSessionResult;
    }
  } catch {
    // Graceful ignore
  }
  return null;
}


/**
 * Persist final AI-proctoring counters through the authoritative Spring Boot API.
 * The summary DTO intentionally contains only these three aggregate fields.
 */
export async function submitProctoringSummary(
  params: {
    attemptId: number;
    authToken?: string;
    totalFaceChecks: number;
    identityMatches: number;
    identityMismatches: number;
  },
): Promise<void> {
  const token = params.authToken?.trim();
  const response = await fetch(
    ENDPOINTS.proctoring.summary(params.attemptId),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token
          ? {
              Authorization: token.startsWith("Bearer ")
                ? token
                : `Bearer ${token}`,
            }
          : {}),
      },
      body: JSON.stringify({
        totalFaceChecks: Math.max(0, Math.floor(params.totalFaceChecks)),
        identityMatches: Math.max(0, Math.floor(params.identityMatches)),
        identityMismatches: Math.max(0, Math.floor(params.identityMismatches)),
      }),
      signal: AbortSignal.timeout(4000),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Proctoring summary submission failed (${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
    );
  }
}
