// AI Proctoring Microservice HTTP & WebSocket Client

export const AI_PROCTORING_BASE_URL =
  process.env.NEXT_PUBLIC_AI_PROCTORING_URL || "http://localhost:8000";

export const AI_PROCTORING_WS_URL =
  process.env.NEXT_PUBLIC_AI_PROCTORING_WS_URL || "ws://localhost:8000";

export interface AIHealthResponse {
  status: string;
  service: string;
  models: {
    yunet: boolean;
    sface: boolean;
    yolo: boolean;
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
  status: string;
  faceDetected: boolean;
  referenceRegistered: boolean;
  message: string;
}

export interface AnalyzeFramePayload {
  sessionId: string;
  frame?: string; // base64 image
  audio?: number[]; // PCM float samples
}

export interface TelemetryResponse {
  status: string;
  faceDetected: boolean;
  numFaces: number;
  identityVerified: boolean;
  similarityScore: number;
  phoneDetected: boolean;
  micLevel: number;
  voiceActive: boolean;
  loudVoice: boolean;
  warningCount: number;
  malpracticeEvent: string | null;
  eventMessage: string | null;
  autoSubmitted: boolean;
}

export interface StopSessionResult {
  status: string;
  totalVerifications: number;
  identityMatches: number;
  identityMismatches: number;
  totalWarnings: number;
}

/**
 * Check if the Python AI microservice is online and loaded.
 * No fake fallbacks allowed.
 */
export async function checkAIHealth(): Promise<{ isOnline: boolean; details?: AIHealthResponse }> {
  try {
    const res = await fetch(`${AI_PROCTORING_BASE_URL}/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500),
    });
    if (res.ok) {
      const data = (await res.json()) as AIHealthResponse;
      return { isOnline: data.status === "UP", details: data };
    }
  } catch {
    // Offline
  }
  return { isOnline: false };
}

/**
 * Registers student reference photo and initializes authoritative AI proctoring session.
 * Throws explicit error if Python AI is offline or reference face registration fails.
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

  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed." }));
    throw new Error(err.detail || "Reference photo registration failed. Ensure your face is clearly visible.");
  }

  return (await res.json()) as StartSessionResult;
}

/**
 * REST Fallback frame analysis endpoint
 */
export async function analyzeFrameREST(
  payload: AnalyzeFramePayload
): Promise<TelemetryResponse> {
  const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/analyze-frame`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
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
  sessionId: string
): Promise<StopSessionResult | null> {
  try {
    const res = await fetch(`${AI_PROCTORING_BASE_URL}/proctor/stop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ sessionId }),
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
