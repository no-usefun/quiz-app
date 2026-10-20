// AI Proctoring Microservice HTTP & WebSocket Client

const isDevelopment = process.env.NODE_ENV === "development";

export const AI_PROCTORING_BASE_URL = (
  process.env.NEXT_PUBLIC_AI_PROCTORING_URL?.trim() ||
  (isDevelopment ? "http://localhost:8000" : "")
).replace(/\/+$/, "");

export const AI_PROCTORING_WS_URL = (
  process.env.NEXT_PUBLIC_AI_PROCTORING_WS_URL?.trim() ||
  (isDevelopment ? "ws://localhost:8000" : "")
).replace(/\/+$/, "");

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
export async function checkAIHealth(): Promise<{ isOnline: boolean; biometricReady: boolean; details?: AIHealthResponse }> {
  // Never point a deployed browser at the student's own localhost by default.
  // Production deployments must explicitly configure the AI service URL.
  if (!AI_PROCTORING_BASE_URL) {
    return { isOnline: false, biometricReady: false };
  }

  try {
    const res = await fetch(`${AI_PROCTORING_BASE_URL}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // Required by browser requests when the configured service is an ngrok tunnel.
        ...(AI_PROCTORING_BASE_URL.includes(".ngrok-free.dev")
          ? { "ngrok-skip-browser-warning": "true" }
          : {}),
      },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as AIHealthResponse;
      const isOnline = data.status === "UP" || data.status === "DEGRADED";
      // A usable AI session needs both face detection and the SFace identity model.
      const biometricReady =
        data.biometricAvailable === true &&
        data.models?.yunet === true &&
        data.models?.sface === true;
      return { isOnline, biometricReady, details: data };
    }
  } catch {
    // Offline
  }
  return { isOnline: false, biometricReady: false };
}

/**
 * Registers student reference photo and initializes authoritative AI proctoring session.
 * Strictly throws explicit error if Python AI is offline or reference face registration fails.
 */
export async function startProctoringSession(
  params: StartSessionParams
): Promise<StartSessionResult> {
  const health = await checkAIHealth();
  if (!health.isOnline) {
    throw new Error(
      "AI_PROCTORING_OFFLINE: The AI Proctoring service is currently unavailable. Contact your test administrator."
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
  if (!result.referenceRegistered || !result.biometricReady) {
    throw new Error("BIOMETRIC_REGISTRATION_FAILED: Could not establish biometric identity baseline.");
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
  const baseUrl = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
  ).replace(/\/+$/, "");
  const token = params.authToken?.trim();
  const response = await fetch(
    `${baseUrl}/api/v1/attempts/${params.attemptId}/proctoring-summary`,
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
