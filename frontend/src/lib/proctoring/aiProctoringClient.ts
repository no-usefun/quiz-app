// AI Proctoring Microservice HTTP & WebSocket Client

export const AI_PROCTORING_BASE_URL =
  process.env.NEXT_PUBLIC_AI_PROCTORING_URL || "http://localhost:8000";

export const AI_PROCTORING_WS_URL =
  process.env.NEXT_PUBLIC_AI_PROCTORING_WS_URL || "ws://localhost:8000";

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
  studentId: string;
  testCode: string;
  referenceImage: string; // base64 JPEG/PNG
  authToken?: string;
  springBootUrl?: string;
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
  ticket?: string;
  authToken?: string;
  studentId?: string;
  attemptId?: number;
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
  try {
    const res = await fetch(`${AI_PROCTORING_BASE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as AIHealthResponse;
      const isOnline = data.status === "UP" || data.status === "DEGRADED";
      const biometricReady = data.biometricAvailable === true && data.models?.sface === true;
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (params.authToken) {
    headers["Authorization"] = params.authToken.startsWith("Bearer ")
      ? params.authToken
      : `Bearer ${params.authToken}`;
  }

  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/start`, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed." }));
    throw new Error(err.detail || "Reference photo registration failed. Ensure your face is clearly visible.");
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (payload.authToken) {
    headers["Authorization"] = payload.authToken.startsWith("Bearer ")
      ? payload.authToken
      : `Bearer ${payload.authToken}`;
  }
  if (payload.ticket) {
    headers["X-Proctor-Ticket"] = payload.ticket;
  }

  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/analyze-frame`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (payload.authToken) {
      headers["Authorization"] = payload.authToken.startsWith("Bearer ")
        ? payload.authToken
        : `Bearer ${payload.authToken}`;
    }
    if (payload.ticket) {
      headers["X-Proctor-Ticket"] = payload.ticket;
    }

    const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/stop`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
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
