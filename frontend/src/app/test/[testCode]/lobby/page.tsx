"use client";

// src/app/test/[testCode]/lobby/page.tsx

import { use, useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Loader2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { CameraReferenceCapture } from "@/components/CameraReferenceCapture";
import { checkAIHealth } from "@/lib/proctoring/aiProctoringClient";

import { ApiClientError, api, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  AttemptResponse,
  AttemptStateResponse,
  QuizAvailabilityResponse,
} from "@/lib/types";

function formatDateTime(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getLoginRedirect(testCode: string): string {
  return `/login?role=student&redirect=${encodeURIComponent(
    `/test/${testCode}/lobby`,
  )}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function LobbyInner({ testCode }: { testCode: string }) {
  const router = useRouter();
  const cleanCode = String(testCode || "")
    .trim()
    .toUpperCase();

  const [availability, setAvailability] =
    useState<QuizAvailabilityResponse | null>(null);
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null);
  const [captureRequested, setCaptureRequested] = useState(false);
  const [pendingStartAfterCapture, setPendingStartAfterCapture] = useState(false);
  const referencePhotoRef = useRef<string | null>(null);
  const handleStartAssessmentRef = useRef<(() => Promise<void>) | null>(null);
  const freshPhotoForStartRef = useRef(false);
  const pendingStartAfterCaptureRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!cleanCode) {
      // No code means there is no availability request to make; show the invalid-code state.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- route validation reset
      setAvailability({
        quizCode: "",
        available: false,
        status: "NOT_FOUND",
        aiProctoringEnabled: false,
        startTime: null,
        endTime: null,
      });
      setStartError("Assessment code is missing.");
      setLoading(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setLoading(true);
        setAvailability(null);
        setStartError(null);

        const result = await api.get<QuizAvailabilityResponse>(
          ENDPOINTS.student.availability(cleanCode),
          {
            retry: 2,
            retryDelayMs: 300,
            cache: "no-store",
          },
        );

        if (cancelled) return;

        // Different backend versions may expose the flag on availability or on
        // the student-safe package. Read both so a false/missing availability
        // default cannot hide AI that the teacher explicitly enabled.
        const availabilityRecord = result as QuizAvailabilityResponse & Record<string, unknown>;
        const readProctoringFlag = (value: unknown): boolean | undefined => {
          if (!value || typeof value !== "object") return undefined;
          const record = value as Record<string, unknown>;
          const direct =
            record.aiProctoringEnabled ??
            record.ai_proctoring_enabled ??
            record.proctoringEnabled;
          if (typeof direct === "boolean") return direct;

          const nested = record.settings;
          if (nested && typeof nested === "object") {
            const settings = nested as Record<string, unknown>;
            const candidate =
              settings.aiProctoringEnabled ??
              settings.ai_proctoring_enabled ??
              settings.proctoringEnabled;
            if (typeof candidate === "boolean") return candidate;
          }
          return undefined;
        };

        let packageFlag: boolean | undefined;
        try {
          const packageResponse = await api.get<unknown>(
            ENDPOINTS.student.quizPackageByCode(cleanCode),
            { retry: 0, cache: "no-store" },
          );
          packageFlag = readProctoringFlag(packageResponse);
        } catch {
          // Some backends only expose the package after an attempt is created.
        }

        const availabilityFlag = readProctoringFlag(availabilityRecord);
        // Enabling wins if either authoritative student endpoint says true.
        // Explicit false is retained only when neither endpoint enables AI.
        const aiProctoringEnabled =
          availabilityFlag === true || packageFlag === true
            ? true
            : availabilityFlag === false || packageFlag === false
              ? false
              : undefined;

        setAvailability({
          ...result,
          ...(typeof aiProctoringEnabled === "boolean"
            ? { aiProctoringEnabled }
            : {}),
        });

        if (typeof aiProctoringEnabled !== "boolean") {
          setStartError(
            "The server did not confirm whether AI proctoring is required for this assessment. Ask your instructor to verify the backend configuration before starting.",
          );
        }
      } catch (error) {
        if (cancelled) return;

        console.error("Assessment availability check failed:", error);

        if (error instanceof ApiClientError && error.status === 401) {
          router.replace(getLoginRedirect(cleanCode));
          return;
        }

        setStartError(
          getApiErrorMessage(
            error,
            "Could not check assessment availability. Please try again.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAvailability();

    return () => {
      cancelled = true;
    };
  }, [cleanCode, router]);

  const status = availability?.status;
  const isLive = status === "LIVE" && availability?.available === true;

  useEffect(() => {
    if (!pendingStartAfterCapture || !referencePhoto || isStarting) return;
    if (!freshPhotoForStartRef.current) return;
    setCaptureRequested(false);
    setPendingStartAfterCapture(false);
    pendingStartAfterCaptureRef.current = false;
    void handleStartAssessmentRef.current?.();
  }, [pendingStartAfterCapture, referencePhoto, isStarting]);
  // A missing policy is a configuration error, never an implicit standard-mode assessment.
  const aiPolicyKnown = typeof availability?.aiProctoringEnabled === "boolean";
  const aiRequired = availability?.aiProctoringEnabled === true;

  const handleStartAssessment = async () => {
    if (!isLive) {
      setStartError("This assessment is not currently live.");
      return;
    }

    if (!aiPolicyKnown) {
      setStartError(
        "The server has not confirmed this assessment's AI proctoring policy. You cannot start until the backend returns aiProctoringEnabled as true or false.",
      );
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    // Every Start click for an AI-proctored assessment must capture a new
    // frame. Never trust the previous preview or a sessionStorage reference.
    if (aiRequired && !freshPhotoForStartRef.current) {
      sessionStorage.removeItem("dynoquizz_reference_photo");
      referencePhotoRef.current = null;
      setReferencePhoto(null);
      setStartError("Capturing a fresh reference photo. Keep only yourself in frame.");
      pendingStartAfterCaptureRef.current = true;
      setPendingStartAfterCapture(true);
      setCaptureRequested(false);
      setCaptureRequested(true);
      return;
    }

    const freshReferencePhoto = aiRequired ? referencePhotoRef.current : null;
    if (aiRequired && !freshReferencePhoto) {
      freshPhotoForStartRef.current = false;
      setStartError("A fresh reference photo could not be captured. Please try again.");
      return;
    }

    sessionStorage.setItem(`dynoquizz_ai_proctoring_${cleanCode}`, String(aiRequired));

    setIsStarting(true);
    setStartError(null);

    try {
      if (aiRequired) {
        const aiHealth = await checkAIHealth();
        if (!aiHealth.isOnline) throw new Error("AI proctoring is currently unavailable. Please retry in a moment or contact your instructor.");
        if (!aiHealth.biometricReady) throw new Error("The biometric verification model is not ready. Please retry shortly.");
      }

      // Fullscreen is required before the server creates the attempt.
      // Starting an attempt outside fullscreen would bypass the exam UI
      // protection, so a denied fullscreen request stops the flow here.
      try {
        if (typeof document !== "undefined" && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        throw new Error(
          "Fullscreen permission is required to start this assessment. Please allow fullscreen and try again.",
        );
      }

      if (
        typeof document !== "undefined" &&
        !document.fullscreenElement
      ) {
        throw new Error(
          "The assessment can only start in fullscreen mode. Please re-enter fullscreen and try again.",
        );
      }
      /*
       * Step 1:
       * Ask the backend to create or resume the attempt for the
       * currently authenticated student.
       *
       * The backend derives student identity from the JWT.
       * No registration number or attempt ID is sent in the request.
       */
      let attempt: AttemptResponse | null = null;
      const pendingAttemptKey = `dynoquizz_pending_proctor_attempt_${cleanCode}`;
      const pendingAttemptRaw = sessionStorage.getItem(pendingAttemptKey);

      // If proctor startup rejected the previous photo, reuse the same active
      // server attempt after verifying it is still IN_PROGRESS. This avoids
      // creating a second attempt or relying on the assessment's resume policy.
      if (pendingAttemptRaw) {
        let pendingAttempt: AttemptResponse | null = null;
        try {
          const candidate = JSON.parse(pendingAttemptRaw) as Partial<AttemptResponse>;
          if (
            candidate.attemptId != null &&
            candidate.quizId != null &&
            candidate.effectiveDeadline &&
            candidate.startedAt
          ) {
            pendingAttempt = candidate as AttemptResponse;
          }
        } catch {
          pendingAttempt = null;
        }

        if (pendingAttempt) {
          try {
            const currentState = await api.get<AttemptStateResponse>(
              ENDPOINTS.student.attemptState(pendingAttempt.attemptId),
              { retry: 1, cache: "no-store" },
            );
            if (
              currentState.status === "IN_PROGRESS" &&
              Number(currentState.quizId) === Number(pendingAttempt.quizId)
            ) {
              attempt = {
                ...pendingAttempt,
                effectiveDeadline:
                  currentState.effectiveDeadline || pendingAttempt.effectiveDeadline,
              };
            } else {
              sessionStorage.removeItem(pendingAttemptKey);
              throw new Error(
                currentState.status === "AUTO_SUBMITTED"
                  ? "The previous attempt was automatically submitted and cannot be restarted."
                  : "The previous attempt is no longer active. Return to the dashboard to review its status.",
              );
            }
          } catch (error) {
            if (error instanceof ApiClientError && error.status === 404) {
              sessionStorage.removeItem(pendingAttemptKey);
            } else {
              throw error;
            }
          }
        } else {
          sessionStorage.removeItem(pendingAttemptKey);
        }
      }

      try {
        if (!attempt) {
          attempt = await api.post<AttemptResponse>(
            ENDPOINTS.student.startAttempt(cleanCode),
          );
        }
      } catch (error) {
        if (error instanceof ApiClientError) {
          const code = String(error.errorCode || "").toUpperCase();

          if (error.status === 401) {
            router.replace(getLoginRedirect(cleanCode));
            return;
          }

          if (error.status === 409 && code === "ATTEMPT_ALREADY_SUBMITTED") {
            throw new Error("This assessment has already been submitted.");
          }

          if (code === "QUIZ_NOT_STARTED") {
            throw new Error("This assessment has not started yet.");
          }

          if (code === "QUIZ_ENDED") {
            throw new Error("This assessment has already ended.");
          }

          if (code === "QUIZ_NOT_AVAILABLE") {
            throw new Error("This assessment is not currently available.");
          }

          if (code === "STUDENT_REGISTRATION_NOT_ALLOWED") {
            throw new Error(
              "Your registration number is not allowed for this assessment.",
            );
          }

          if (code === "STUDENT_NOT_ELIGIBLE") {
            throw new Error(
              "Your account is not eligible for this assessment.",
            );
          }

          if (
            code === "ATTEMPT_RESUME_NOT_ALLOWED" ||
            code === "RESUME_NOT_ALLOWED"
          ) {
            throw new Error(
              "You already have an unfinished attempt for this assessment, but the instructor has disabled resume.",
            );
          }

          if (code === "ATTEMPT_EXPIRED") {
            throw new Error(
              "Your previous assessment attempt has expired and cannot be resumed.",
            );
          }

          if (error.status === 403) {
            throw new Error(
              error.message ||
                "You are not authorized to take this assessment.",
            );
          }
        }

        throw error;
      }

      if (!attempt?.attemptId) {
        throw new Error(
          "The server did not return a valid assessment attempt ID.",
        );
      }

      if (
        typeof attempt.effectiveDeadline !== "string" ||
        !attempt.effectiveDeadline
      ) {
        throw new Error(
          "The server did not return the authoritative assessment deadline.",
        );
      }

      const attemptId = String(attempt.attemptId);
      localStorage.setItem("dynoquizz_attemptId", attemptId);
      localStorage.setItem(`dynoquizz_attemptId_${attempt.quizId}`, attemptId);
      localStorage.setItem(`dynoquizz_attemptId_${cleanCode}`, attemptId);

      if (aiRequired) {
        sessionStorage.setItem(pendingAttemptKey, JSON.stringify(attempt));
      } else {
        sessionStorage.removeItem(pendingAttemptKey);
      }

      // The arena may only use a reference image accompanied by this
      // attempt-scoped one-navigation freshness marker. Direct navigation or
      // a failed validation cannot silently reuse a prior photo.
      if (aiRequired && freshReferencePhoto) {
        sessionStorage.setItem("dynoquizz_reference_photo", freshReferencePhoto);
        sessionStorage.setItem(`dynoquizz_reference_photo_fresh_${attemptId}`, "true");
      } else {
        sessionStorage.removeItem("dynoquizz_reference_photo");
        sessionStorage.removeItem(`dynoquizz_reference_photo_fresh_${attemptId}`);
      }
      freshPhotoForStartRef.current = false;

      /*
       * Only enter the exam arena after a fresh frame has been captured and
       * the server attempt is present. The arena remains locked until
       * /proctor/start confirms referenceRegistered=true and returns telemetry.
       */
      router.push(`/test/${encodeURIComponent(cleanCode)}`);
    } catch (error) {
      console.error("Start assessment error:", error);

      if (error instanceof ApiClientError && error.status === 401) {
        router.replace(getLoginRedirect(cleanCode));
        return;
      }

      freshPhotoForStartRef.current = false;
      pendingStartAfterCaptureRef.current = false;
      setPendingStartAfterCapture(false);
      setCaptureRequested(false);
      sessionStorage.removeItem("dynoquizz_reference_photo");
      referencePhotoRef.current = null;
      setReferencePhoto(null);
      setStartError(
        getApiErrorMessage(
          error,
          "Could not start the assessment. Please check your connection and try again.",
        ),
      );
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    handleStartAssessmentRef.current = handleStartAssessment;
  }, [handleStartAssessment]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
          <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
          Checking Assessment Availability...
        </div>
      </div>
    );
  }

  if (!availability || !isLive) {
    let availabilityMessage =
      startError || "This assessment is not currently available.";

    if (!startError) {
      switch (status) {
        case "NOT_STARTED":
          availabilityMessage = availability?.startTime
            ? `This assessment has not started yet. It starts at ${formatDateTime(
                availability.startTime,
              )}.`
            : "This assessment has not started yet.";
          break;

        case "ENDED":
          availabilityMessage = "This assessment has already ended.";
          break;

        case "NOT_PUBLISHED":
          availabilityMessage =
            "This assessment is not open yet. Ask your instructor to publish it.";
          break;

        case "NOT_FOUND":
          availabilityMessage = `The assessment code ${cleanCode} does not exist.`;
          break;

        case "LIVE":
          availabilityMessage = "This assessment is not currently available.";
          break;

        default:
          break;
      }
    }

    return (
      <div className="mx-auto max-w-md rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#fbeee8] text-[#8c381c] shadow-xs">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h2 className="text-lg font-bold text-[#111111]">
          Assessment Unavailable
        </h2>

        <p className="mt-2 text-xs text-[#78716b] leading-relaxed font-medium">
          {availabilityMessage}
        </p>

        <Link
          href="/join"
          className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#222222] active:scale-[0.98] shadow-sm transition-all"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Join
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#78716b] hover:text-[#111111] transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Gateway
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#165dfb] animate-pulse" />

          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
            Assessment
          </span>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#d1dee8]/70 bg-white p-6 md:p-8 space-y-6 shadow-xl">
        <div className="border-b border-[#d1dee8]/50 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="rounded-full bg-[#165dfb] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-xs">
              {cleanCode}
            </span>

            <span className="text-xs font-semibold text-[#78716b]">
              <span className="font-bold text-[#1d5237]">Available</span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">
            Ready to begin?
          </h1>

                  </div>

         <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {!aiPolicyKnown && (
            <div className="rounded-[10px] border border-[#8c381c]/30 bg-[#fbeee8] p-3 text-xs font-semibold leading-relaxed text-[#8c381c]">
We couldn’t verify this assessment’s security settings. Please contact your instructor.
            </div>
          )}
 
          {startError && (
            <div className="rounded-[10px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold flex items-center gap-2 shadow-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {startError}
            </div>
          )}

          {aiRequired && (
            <CameraReferenceCapture
              captureRequested={captureRequested}
              onCapture={(photo) => {
                referencePhotoRef.current = photo;
                setReferencePhoto(photo);
                // Only a capture requested by the Start button is eligible for
                // this attempt. Manual previews are never trusted as a baseline.
                if (pendingStartAfterCaptureRef.current) {
                  freshPhotoForStartRef.current = true;
                }
                sessionStorage.removeItem("dynoquizz_reference_photo");
                localStorage.removeItem("dynoquizz_reference_photo");
                setStartError(null);
              }}
              onCaptureError={(message) => {
                freshPhotoForStartRef.current = false;
                pendingStartAfterCaptureRef.current = false;
                setPendingStartAfterCapture(false);
                setCaptureRequested(false);
                referencePhotoRef.current = null;
                setReferencePhoto(null);
                sessionStorage.removeItem("dynoquizz_reference_photo");
                setStartError(message);
              }}
              disabled={isStarting}
            />
          )}

           <div className="space-y-2">
            <button
              type="button"
              onClick={handleStartAssessment}
              disabled={isStarting || pendingStartAfterCapture || !aiPolicyKnown}
              className="w-full flex items-center justify-center gap-2 rounded-[10px] bg-[#111111] py-3.5 text-sm font-bold text-white hover:bg-[#222222] active:scale-[0.98] shadow-sm hover:shadow-md transition-all cursor-pointer border-0 disabled:opacity-70"
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  {pendingStartAfterCapture ? "Capturing fresh photo…" : "Start assessment"}
                  {!pendingStartAfterCapture && <ArrowRight className="h-4 w-4" />}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function AssessmentLobbyPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <header className="sticky top-0 z-40 w-full border-b border-[#d1dee8]/70 bg-white/95 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <Logo />

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/student"
              className="rounded-[10px] border border-[#d1dee8]/80 bg-[#f5f5f4] px-3.5 py-2 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] hover:text-[#111111] shadow-xs active:scale-95 transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
              <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
              Loading...
            </div>
          }
        >
          <LobbyInner testCode={testCode} />
        </Suspense>
      </main>
    </div>
  );
}
