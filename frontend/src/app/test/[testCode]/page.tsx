"use client";

// frontend/src/app/test/[testCode]/page.tsx

import { use, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AppWindow,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Maximize2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { useAIProctoring } from "@/hooks/useAIProctoring";
import { AIProctoringHUD } from "@/components/AIProctoringHUD";
import { ProctoringWarningModal } from "@/components/ProctoringWarningModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ApiClientError, api, clearApiCache, getAuthToken } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type {
  AttemptStateResponse,
  QuizPackageResponse,
  QuestionResponse,
  SubmitAttemptResponse,
} from "@/lib/types";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type ActiveAnswerState = Record<number, number[]>;

type AttemptScoringSnapshot = {
  negativeMarking: boolean;
  questions: Record<number, { marks: number; negativeMarks: number | null }>;
};

function buildAttemptScoringSnapshot(
  test: QuizPackageResponse | null | undefined,
): AttemptScoringSnapshot | undefined {
  if (!test || !Array.isArray(test.questions) || test.questions.length === 0) {
    return undefined;
  }

  const questions = test.questions.reduce<
    AttemptScoringSnapshot["questions"]
  >((snapshot, question) => {
    const questionId = Number(question.questionId);
    if (!Number.isFinite(questionId) || questionId <= 0) return snapshot;

    const marks = Number(question.marks);
    const negativeMarks =
      question.negativeMarks == null ? null : Number(question.negativeMarks);

    snapshot[questionId] = {
      marks: Number.isFinite(marks) ? marks : 0,
      negativeMarks:
        negativeMarks != null && Number.isFinite(negativeMarks)
          ? negativeMarks
          : null,
    };
    return snapshot;
  }, {});

  return {
    negativeMarking: Boolean(test.negativeMarking),
    questions,
  };
}

type BrowserProctoringFlag =
  | "tab_switch"
  | "fullscreen_exit"
  | "right_click"
  | "copy_attempt"
  | "cut_attempt"
  | "paste_attempt"
  | "focus_loss"
  | "keyboard_attempt"
  | "screenshot_attempt"
  | "reconnect_count";

type BrowserProctoringFlags = Record<BrowserProctoringFlag, number>;

type CachedBrowserActivity = {
  version: 1;
  savedAt: number;
  flags: BrowserProctoringFlags;
  warnings: string[];
};

const BROWSER_ACTIVITY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function browserActivityCacheKey(attemptId: string) {
  return `dynoquizz_browser_activity_${attemptId}`;
}

type BrowserActivityNotice = {
  id: number;
  type: BrowserProctoringFlag;
  title: string;
  message: string;
  policyCount?: number;
};

const BROWSER_EVENT_TITLES: Record<BrowserProctoringFlag, string> = {
  tab_switch: "Tab switch detected",
  fullscreen_exit: "Fullscreen exit detected",
  right_click: "Right-click detected",
  copy_attempt: "Copy attempt detected",
  cut_attempt: "Cut attempt detected",
  paste_attempt: "Paste attempt detected",
  focus_loss: "Window focus lost",
  keyboard_attempt: "Restricted shortcut detected",
  screenshot_attempt: "Screenshot shortcut detected",
  reconnect_count: "Network reconnection detected",
};

const initialBrowserFlags: BrowserProctoringFlags = {
  tab_switch: 0,
  fullscreen_exit: 0,
  right_click: 0,
  copy_attempt: 0,
  cut_attempt: 0,
  paste_attempt: 0,
  focus_loss: 0,
  keyboard_attempt: 0,
  screenshot_attempt: 0,
  reconnect_count: 0,
};

function BrowserActivityPanel({
  flags,
  warnings,
  violationCount,
  restoredFromSession,
}: {
  flags: BrowserProctoringFlags;
  warnings: string[];
  violationCount: number;
  restoredFromSession: boolean;
}) {
  const rows: Array<[string, number]> = [
    ["Tab switches", flags.tab_switch],
    ["Copy attempts", flags.copy_attempt],
    ["Paste attempts", flags.paste_attempt],
    ["Cut attempts", flags.cut_attempt],
    ["Fullscreen exits", flags.fullscreen_exit],
    ["Focus losses", flags.focus_loss],
    ["Right-clicks", flags.right_click],
    ["Restricted shortcuts", flags.keyboard_attempt],
    ["Screenshot attempts", flags.screenshot_attempt],
    ["Reconnections", flags.reconnect_count],
  ];
  const recentWarnings = warnings.slice(-5).reverse();

  return (
    <section
      aria-label="Browser activity monitoring"
      aria-live="polite"
      className="rounded-xl border border-[#d1dee8] bg-white p-3 text-left dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-[#165dfb] dark:text-blue-300" />
          <h2 className="truncate text-xs font-bold text-[#111111] dark:text-slate-100">
            Browser activity
          </h2>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${
          violationCount > 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        }`}>
          {violationCount > 0 ? `${violationCount} event${violationCount === 1 ? "" : "s"}` : "Monitoring"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {rows.map(([label, count]) => (
          <div
            key={label}
            className="min-w-0 rounded-lg border border-[#d1dee8]/70 bg-[#f8fafc] px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-[#78716b] dark:text-slate-400">
              {label}
            </p>
            <p className={`mt-0.5 text-sm font-extrabold tabular-nums ${
              count > 0 ? "text-rose-600 dark:text-rose-300" : "text-[#111111] dark:text-slate-100"
            }`}>
              {count}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-[#d1dee8]/70 pt-3 dark:border-slate-700">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-[#78716b] dark:text-slate-400">
            Recent activity
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            {restoredFromSession ? "Session cache" : "Live session"}
          </span>
        </div>
        {recentWarnings.length > 0 ? (
          <ul className="space-y-2">
            {recentWarnings.map((message, index) => (
              <li key={`${message}-${index}`} className="flex items-start gap-2 text-[10px] leading-relaxed text-[#57534e] dark:text-slate-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />
                <span className="min-w-0 break-words">{message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[10px] leading-relaxed text-[#78716b] dark:text-slate-400">
            No browser activity flags recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}

function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

function parseBackendDeadline(value: string): number {
  /*
   * Spring LocalDateTime is returned without an offset.
   * Treat it as the browser's local wall-clock time. This matches the
   * current India-focused backend/frontend contract.
   */
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const timestamp = new Date(normalized).getTime();

  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function getLoginRedirect(testCode: string): string {
  return `/login?role=student&redirect=${encodeURIComponent(
    `/test/${testCode}/lobby`,
  )}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function describeIdentityHoldReason(reason?: string | null): string {
  const key = String(reason || "IDENTITY_VERIFICATION_PENDING")
    .trim()
    .toUpperCase()
    .replace(/[\\s-]+/g, "_");

  const messages: Record<string, string> = {
    INITIALIZING: "Initializing the verified identity session. Keep your face visible.",
    IDENTITY_VERIFICATION_PENDING: "Waiting for the proctoring service to verify the registered student.",
    IDENTITY_HOLD_STATUS_UNAVAILABLE: "The service did not return the required identity-hold status. The assessment is locked for safety.",
    PROCTORING_TELEMETRY_UNAVAILABLE: "Live identity telemetry was interrupted. The assessment will remain locked until the service responds again.",
    CAMERA_UNAVAILABLE: "Camera access was interrupted. Restore camera access and restart the reference-photo validation.",
    NO_FACE: "No face is visible. Return your face to the camera so identity can be re-verified.",
    NO_FACE_DETECTED: "No face is visible. Return your face to the camera so identity can be re-verified.",
    FACE_NOT_DETECTED: "No face is visible. Return your face to the camera so identity can be re-verified.",
    PERSON_VALIDATION_UNAVAILABLE: "The service could not reliably validate how many people are present. The assessment remains locked while validation recovers.",
    EMBEDDING_EXTRACTION_FAILED: "The identity reference could not be processed reliably. Return to the lobby and capture a fresh reference photo.",
    MULTIPLE_FACES: "Multiple faces are visible. Ensure only the registered student is in camera view.",
    MULTIPLE_FACES_DETECTED: "Multiple faces are visible. Ensure only the registered student is in camera view.",
    MULTIPLE_PERSONS: "More than one person is in view. Ensure only the registered student remains in the camera view.",
    MULTIPLE_PERSONS_DETECTED: "More than one person is in view. Ensure only the registered student remains in the camera view.",
    IDENTITY_MISMATCH: "The person in the camera does not match the registered student. The registered student must return.",
    AUTO_SUBMITTED: "The backend has confirmed that this assessment was automatically submitted.",
  };

  return messages[key] || `Identity verification is on hold (${String(reason || "reason not supplied").replaceAll("_", " ")}). Keep the camera active while the service re-checks your identity.`;
}

function normalizeAnswers(raw: unknown): ActiveAnswerState {
  if (!raw || typeof raw !== "object") return {};

  const result: ActiveAnswerState = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const questionId = Number(key);
    if (!Number.isFinite(questionId) || questionId <= 0) continue;

    const ids = Array.isArray(value) ? value : [value];
    result[questionId] = [...new Set(
      ids.map(Number).filter((id) => Number.isFinite(id) && id > 0),
    )];
  }

  return result;
}

function normalizeTimeTaken(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== "object") return {};

  const result: Record<number, number> = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const questionId = Number(key);
    const seconds = Number(value);

    if (
      Number.isFinite(questionId) &&
      questionId > 0 &&
      Number.isFinite(seconds) &&
      seconds >= 0
    ) {
      result[questionId] = Math.floor(seconds);
    }
  }

  return result;
}

function persistAttemptDraft(
  attemptId: string | null,
  answers: ActiveAnswerState,
  timeTaken: Record<number, number>,
  scoringSnapshot?: AttemptScoringSnapshot,
) {
  if (typeof window === "undefined" || !attemptId) return;

  try {
    const key = `dynoquizz_pending_submit_${attemptId}`;
    let retainedScoring = scoringSnapshot;

    // Page-hide, timer, and retry writes may not have the loaded quiz package
    // in scope. Keep the last valid scoring snapshot instead of dropping it.
    if (!retainedScoring) {
      try {
        const previous = JSON.parse(localStorage.getItem(key) || "null");
        const previousScoring = previous?.scoring;
        if (
          previousScoring &&
          typeof previousScoring.negativeMarking === "boolean" &&
          previousScoring.questions &&
          typeof previousScoring.questions === "object"
        ) {
          retainedScoring = previousScoring as AttemptScoringSnapshot;
        }
      } catch {
        // Continue with the current answer/time draft if prior metadata is invalid.
      }
    }

    localStorage.setItem(
      key,
      JSON.stringify({
        answers,
        timeTaken,
        savedAt: Date.now(),
        ...(retainedScoring ? { scoring: retainedScoring } : {}),
      }),
    );
  } catch {
    // Best-effort retry storage only.
  }
}

/**
 * Clears transient data for a completed attempt while preserving the option
 * text snapshots used by the results page for compatibility with older APIs.
 */
function cleanupAttemptRuntimeState(
  attemptId: string | null,
  testCode: string,
  options: { preservePendingSubmitDraft?: boolean } = {},
) {
  if (typeof window === "undefined") return;
  clearApiCache();

  const code = String(testCode || "").trim().toUpperCase();
  if (attemptId) {
    if (!options.preservePendingSubmitDraft) {
      localStorage.removeItem(`dynoquizz_pending_submit_${attemptId}`);
    }
    sessionStorage.removeItem(`dynoquizz_reference_photo_fresh_${attemptId}`);
  }

  localStorage.removeItem(`dynoquizz_attemptId_${code}`);
  localStorage.removeItem("dynoquizz_attemptId");
  localStorage.removeItem(`dynoquizz_active_test_${code}`);
  localStorage.removeItem(`dynoquizz_attemptTiming_${code}`);
  localStorage.removeItem(`dynoquizz_pkg_${code}`);

  sessionStorage.removeItem(`dynoquizz_pending_proctor_attempt_${code}`);
  sessionStorage.removeItem("dynoquizz_reference_photo");
  localStorage.removeItem("dynoquizz_reference_photo");

  // Keep quiz-level option-text snapshots as a compatibility fallback for
  // older result responses. New submissions no longer create submit markers.
}

function persistQuizOptionSnapshot(
  attemptId: string | null,
  quizId: number | string | null | undefined,
  packageData: QuizPackageResponse,
) {
  if (typeof window === "undefined" || !attemptId) return;

  const optionTextByQuestion = (packageData.questions ?? []).reduce<
    Record<number, Record<number, string>>
  >((questionMap, question) => {
    const questionId = Number(question.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return questionMap;
    }

    questionMap[questionId] = Object.fromEntries(
      (question.options ?? []).map((option) => [
        Number(option.optionId),
        String(option.optionText ?? ""),
      ]),
    );

    return questionMap;
  }, {});

  try {
    const serialized = JSON.stringify(optionTextByQuestion);

    localStorage.setItem(
      `dynoquizz_option_texts_attempt_${attemptId}`,
      serialized,
    );

    if (quizId != null && Number.isFinite(Number(quizId))) {
      localStorage.setItem(
        `dynoquizz_option_texts_quiz_${Number(quizId)}`,
        serialized,
      );
    }
  } catch {
    // Best-effort historical result snapshot only.
  }
}

export default function TestArenaPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const router = useRouter();

  const cleanCode = String(testCode || "")
    .trim()
    .toUpperCase();

  const [test, setTest] = useState<QuizPackageResponse | null>(null);
  const [isLoadingTest, setIsLoadingTest] = useState(true);
  const [testLoadError, setTestLoadError] = useState<string | null>(null);

  const [activeAttemptId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return (
      localStorage.getItem(`dynoquizz_attemptId_${cleanCode}`) ||
      localStorage.getItem("dynoquizz_attemptId")
    );
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ActiveAnswerState>({});
  const [markedForReview, setMarkedForReview] = useState<Record<number, boolean>>({});
  const [timeTakenPerQuestion, setTimeTakenPerQuestion] = useState<
    Record<number, number>
  >({});
  const [effectiveDeadline, setEffectiveDeadline] = useState<string | null>(
    null,
  );
  const [timeLeft, setTimeLeft] = useState(0);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [mobileProctoringOpen, setMobileProctoringOpen] = useState(false);
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const [sessionExpired, setSessionExpired] = useState(false);
  const [deadlineNotice, setDeadlineNotice] = useState<string | null>(null);
  const [submissionNotice, setSubmissionNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStarted, setSubmissionStarted] = useState(false);
  const [deadlineReached, setDeadlineReached] = useState(false);

  const answersRef = useRef<ActiveAnswerState>({});
  const timeTakenRef = useRef<Record<number, number>>({});
  const currentIndexRef = useRef(0);
  const currentQuestionRef = useRef<QuestionResponse | null>(null);
  const expiryHandledRef = useRef(false);
  const submissionInFlightRef = useRef(false);

  // Accept a reference image only when the lobby marked it fresh for this
  // exact server attempt after a Start click. A stale sessionStorage image
  // cannot authorize direct navigation back into the exam.
  const [referencePhoto] = useState<string | null>(() => {
    if (typeof window === "undefined" || !activeAttemptId) return null;
    const freshMarker = sessionStorage.getItem(
      `dynoquizz_reference_photo_fresh_${activeAttemptId}`,
    );
    if (freshMarker !== "true") return null;
    return sessionStorage.getItem("dynoquizz_reference_photo");
  });
  // The backend package is authoritative. Do not use browser storage as the
  // source of truth for a policy that determines whether proctoring is required.
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState<boolean | null>(null);

  const studentUser =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem("dynoquizz_user") || "{}");
          } catch {
            return {};
          }
        })()
      : {};
  const effectiveStudentId = studentUser?.id ? String(studentUser.id) : undefined;

  const finishAssessmentRef = useRef<
    ((
      latestAnswers?: ActiveAnswerState,
      latestTimeTaken?: Record<number, number>,
      allowWhileProctoringBlocked?: boolean,
    ) => Promise<void>) | null
  >(null);

  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document !== "undefined") {
      return Boolean(document.fullscreenElement);
    }
    return true;
  });
  const hasEnteredFullscreenRef = useRef(false);
  const lastBrowserViolationTimeRef = useRef<Partial<Record<"tab_switch" | "fullscreen_exit", number>>>({});
  const lastAuditEventTimeRef = useRef<Partial<Record<BrowserProctoringFlag, number>>>({});
  const [flags, setFlags] = useState<BrowserProctoringFlags>(initialBrowserFlags);
  const flagsRef = useRef<BrowserProctoringFlags>(initialBrowserFlags);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [browserActivityCacheAttemptId, setBrowserActivityCacheAttemptId] = useState<string | null>(null);
  const [browserActivityRestored, setBrowserActivityRestored] = useState(false);
  const [browserNotice, setBrowserNotice] = useState<BrowserActivityNotice | null>(null);
  const browserNoticeIdRef = useRef(0);
  const violationCount = Object.values(flags).reduce(
    (sum, count) => sum + Number(count || 0),
    0,
  );

  useEffect(() => {
    if (!activeAttemptId || typeof window === "undefined") {
      flagsRef.current = initialBrowserFlags;
      return;
    }

    const key = browserActivityCacheKey(activeAttemptId);
    let restored = false;
    let restoredFlags: BrowserProctoringFlags = initialBrowserFlags;
    let restoredWarnings: string[] = [];

    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CachedBrowserActivity>;
        const savedAt = Number(parsed.savedAt);
        const validAge = Number.isFinite(savedAt)
          && savedAt > 0
          && Date.now() - savedAt >= 0
          && Date.now() - savedAt <= BROWSER_ACTIVITY_CACHE_TTL_MS;

        if (parsed.version === 1 && validAge && parsed.flags && typeof parsed.flags === "object") {
          restoredFlags = { ...initialBrowserFlags };
          for (const flag of Object.keys(initialBrowserFlags) as BrowserProctoringFlag[]) {
            const count = Number(parsed.flags[flag]);
            restoredFlags[flag] = Number.isFinite(count) && count >= 0
              ? Math.floor(count)
              : 0;
          }
          restoredWarnings = Array.isArray(parsed.warnings)
            ? parsed.warnings.filter((item): item is string => typeof item === "string").slice(-10)
            : [];
          restored = true;
        } else {
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Session storage may be blocked by the browser.
      }
    }

    flagsRef.current = restoredFlags;
    /* eslint-disable react-hooks/set-state-in-effect -- Rehydrate monitoring counters from sessionStorage for this server attempt. */
    setFlags(restoredFlags);
    setWarnings(restoredWarnings);
    setBrowserActivityRestored(restored);
    setBrowserActivityCacheAttemptId(activeAttemptId);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeAttemptId]);

  useEffect(() => {
    if (
      typeof window === "undefined"
      || !activeAttemptId
      || browserActivityCacheAttemptId !== activeAttemptId
    ) {
      return;
    }

    try {
      const cache: CachedBrowserActivity = {
        version: 1,
        savedAt: Date.now(),
        flags,
        warnings: warnings.slice(-10),
      };
      sessionStorage.setItem(
        browserActivityCacheKey(activeAttemptId),
        JSON.stringify(cache),
      );
    } catch {
      // Monitoring must continue even if browser storage is unavailable/full.
    }
  }, [activeAttemptId, browserActivityCacheAttemptId, flags, warnings]);

  const recordBrowserEvent = useCallback(
    (type: BrowserProctoringFlag, message: string) => {
      const nextFlags = {
        ...flagsRef.current,
        [type]: flagsRef.current[type] + 1,
      };
      flagsRef.current = nextFlags;
      setFlags(nextFlags);
      setWarnings((previous) => [...previous.slice(-9), message]);

      browserNoticeIdRef.current += 1;
      const isPolicyViolation = type === "tab_switch" || type === "fullscreen_exit";
      setBrowserNotice({
        id: browserNoticeIdRef.current,
        type,
        title: BROWSER_EVENT_TITLES[type],
        message,
        ...(isPolicyViolation
          ? { policyCount: nextFlags.tab_switch + nextFlags.fullscreen_exit }
          : {}),
      });
    },
    [],
  );

  useEffect(() => {
    if (!browserNotice) return;
    const noticeId = browserNotice.id;
    const timeoutId = window.setTimeout(() => {
      setBrowserNotice((current) => current?.id === noticeId ? null : current);
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [browserNotice]);

  const proctoring = useAIProctoring({
    attemptId: Number(activeAttemptId || 0),
    testCode: cleanCode,
    referenceImage: referencePhoto,
    authToken: getAuthToken() || undefined,
    onAutoSubmit: () => {
      // The proctoring backend has already confirmed submission. Never send a
      // duplicate client-side submission for the same attempt.
      submissionInFlightRef.current = true;
      setIsSubmitted(true);
      setDeadlineNotice(
        "The proctoring backend confirmed that this assessment was automatically submitted.",
      );
      // Server-triggered auto-submission did not receive the local answer sheet.
      // Retain the draft for recovery rather than deleting the only remaining copy.
      cleanupAttemptRuntimeState(activeAttemptId, cleanCode, { preservePendingSubmitDraft: true });
      if (activeAttemptId) {
        router.replace(`/dashboard/student/result/${activeAttemptId}`);
      }
    },
    enabled: aiProctoringEnabled === true && !isSubmitted && Boolean(activeAttemptId),
  });

  const isAIProctoringReady =
    aiProctoringEnabled === false ||
    (aiProctoringEnabled === true &&
      Boolean(activeAttemptId) &&
      proctoring.isOnline &&
      proctoring.cameraActive &&
      proctoring.referenceRegistered &&
      proctoring.telemetryReceived &&
      !proctoring.identityHold &&
      !proctoring.serverAutoSubmitted &&
      !proctoring.cameraError);

  // State controls rendering, while the ref is checked inside event handlers
  // to close the small window before React commits a hold-state update.
  const examInteractionBlocked =
    aiProctoringEnabled === true &&
    (!isAIProctoringReady ||
      proctoring.identityHold ||
      proctoring.serverAutoSubmitted);

  const isInteractionLockedNow = useCallback(
    () =>
      aiProctoringEnabled === true &&
      (!isAIProctoringReady ||
        proctoring.identityHoldRef.current ||
        proctoring.serverAutoSubmitted),
    [
      aiProctoringEnabled,
      isAIProctoringReady,
      proctoring.identityHoldRef,
      proctoring.serverAutoSubmitted,
    ],
  );

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return false;
    if (document.fullscreenElement) {
      setIsFullscreen(true);
      return true;
    }
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      hasEnteredFullscreenRef.current = true;
      return true;
    } catch {
      setIsFullscreen(false);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || !document.fullscreenElement) return;
    try {
      await document.exitFullscreen();
      setIsFullscreen(false);
    } catch {
      // Ignore browser fullscreen teardown failures.
    }
  }, []);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    timeTakenRef.current = timeTakenPerQuestion;
  }, [timeTakenPerQuestion]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const questions = test?.questions ?? [];
  const currentQuestion = questions[currentIndex] ?? null;

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  const progressPercentage =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredQuestionCount = questions.filter(
    (question) => (answers[Number(question.questionId)] ?? []).length > 0,
  ).length;
  const unansweredQuestionCount = Math.max(0, questions.length - answeredQuestionCount);
  const markedQuestionCount = questions.filter(
    (question) => markedForReview[Number(question.questionId)] === true,
  ).length;

  useEffect(() => {
    if (typeof window === "undefined" || isSubmitted) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitted]);

  const proctoringCleanupRef = useRef(proctoring.cleanup);
  useEffect(() => {
    proctoringCleanupRef.current = proctoring.cleanup;
  }, [proctoring.cleanup]);

  const proctoringSetWarningCountRef = useRef(proctoring.setWarningCount);
  useEffect(() => {
    proctoringSetWarningCountRef.current = proctoring.setWarningCount;
  }, [proctoring.setWarningCount]);

  const proctoringShowWarningModalRef = useRef(proctoring.showWarningModal);
  useEffect(() => {
    proctoringShowWarningModalRef.current = proctoring.showWarningModal;
  }, [proctoring.showWarningModal]);

  const lastBackendWarningCountRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || isSubmitted || !activeAttemptId) {
      return;
    }

    // Tab switches are counted from visibilitychange only. Fullscreen exits
    // retain a short duplicate-event guard, without an initial detection grace period.
    const FULLSCREEN_DUPLICATE_GUARD_MS = 350;

    const reportEvent = async (type: BrowserProctoringFlag, details: string) => {
      // Once submission begins, do not send additional browser events for an
      // attempt that may already have become inactive on the server.
      if (submissionInFlightRef.current || isSubmitted) return;

      const now = Date.now();
      const isCountableViolation = type === "tab_switch" || type === "fullscreen_exit";

      if (type === "fullscreen_exit") {
        const previousViolationAt = lastBrowserViolationTimeRef.current.fullscreen_exit ?? 0;
        if (now - previousViolationAt < FULLSCREEN_DUPLICATE_GUARD_MS) return;
        lastBrowserViolationTimeRef.current.fullscreen_exit = now;
      } else if (!isCountableViolation) {
        const lastTime = lastAuditEventTimeRef.current[type] || 0;
        if (now - lastTime < 600) return;
        lastAuditEventTimeRef.current[type] = now;
      }

      recordBrowserEvent(type, details);

      try {
        if (type === "tab_switch" || type === "fullscreen_exit") {
          // Browser-policy events use the quiz-specific attempt endpoint regardless
          // of the AI camera/identity/audio setting. The backend owns the shared,
          // teacher-configured tab-switch/fullscreen threshold.
          await api.post<void>(
            ENDPOINTS.student.proctoringEvents(activeAttemptId),
            {
              type,
              clientEventId: `browser-${activeAttemptId}-${type}-${now}`,
              metadata: { source: "browser", details, detectedAt: new Date(now).toISOString() },
            },
          );

          // The event endpoint intentionally returns 202 without a body.
          // Reconcile immediately with authoritative attempt state after either
          // kind of policy violation, so a server auto-submit redirects correctly.
          const serverState = await api.get<AttemptStateResponse>(
            ENDPOINTS.student.attemptState(activeAttemptId),
            { cache: "no-store" },
          );

          if (serverState.status !== "IN_PROGRESS") {
            submissionInFlightRef.current = true;
            setIsSubmitted(true);
            setDeadlineNotice(
              type === "fullscreen_exit"
                ? "The assessment was automatically submitted because the configured browser-violation limit was reached."
                : "The assessment was automatically submitted because the configured tab-switch limit was reached.",
            );
            cleanupAttemptRuntimeState(activeAttemptId, cleanCode, {
              preservePendingSubmitDraft: serverState.status === "AUTO_SUBMITTED",
            });
            void proctoringCleanupRef.current();
            router.replace(`/dashboard/student/result/${activeAttemptId}`);
          }
        } else {
          await api.post(
            ENDPOINTS.student.proctoringEvents(activeAttemptId),
            {
              // The backend event contract currently has no screenshot_attempt type.
              // Preserve the distinct signal in metadata until the backend contract is extended.
              type: type === "screenshot_attempt" ? "keyboard_attempt" : type,
              clientEventId: `browser-${activeAttemptId}-${type}-${now}`,
              metadata: {
                source: "browser",
                details,
                ...(type === "screenshot_attempt" ? { originalType: type } : {}),
                detectedAt: new Date(now).toISOString(),
              },
            },
          );
        }
      } catch (error) {
        // A 409 here usually means the server has already closed/submitted the
        // attempt. That is expected during finalization; avoid noisy console
        // errors and keep the student assessment flow uninterrupted.
        if (error instanceof ApiClientError && error.status === 409) {
          // A concurrent server auto-submit can close the attempt between the
          // event post and state check. Reconcile from the authoritative state.
          try {
            const serverState = await api.get<AttemptStateResponse>(
              ENDPOINTS.student.attemptState(activeAttemptId),
              { cache: "no-store" },
            );
            if (serverState.status !== "IN_PROGRESS") {
              submissionInFlightRef.current = true;
              setIsSubmitted(true);
              // A server-side auto-submit can beat the browser's answer-sheet
              // submission. Keep the latest device draft for result recovery.
              cleanupAttemptRuntimeState(activeAttemptId, cleanCode, {
                preservePendingSubmitDraft: serverState.status === "AUTO_SUBMITTED",
              });
              void proctoringCleanupRef.current();
              router.replace(`/dashboard/student/result/${activeAttemptId}`);
            }
          } catch {
            // Preserve the current exam UI if the status endpoint is temporarily unavailable.
          }
          return;
        }
        console.warn("[Proctoring] Browser event sync failed:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void reportEvent("tab_switch", "Candidate switched tabs or minimized the assessment window.");
      }
    };

    const handleBlur = () => {
      // visibilitychange is the single authoritative source for tab switches.
      // This prevents blur + visibilitychange from counting one switch twice.
      if (document.visibilityState !== "hidden") {
        void reportEvent("focus_loss", "The assessment window lost focus while the page remained visible.");
      }
    };

    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) {
        hasEnteredFullscreenRef.current = true;
      } else if (
        hasEnteredFullscreenRef.current &&
        document.visibilityState === "visible"
      ) {
        void reportEvent("fullscreen_exit", "Candidate exited required fullscreen mode.");
      }
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      void reportEvent("right_click", "Right-click was blocked during the assessment.");
    };

    const handleCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportEvent("copy_attempt", "Copy was blocked during the assessment.");
    };

    const handleCut = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportEvent("cut_attempt", "Cut was blocked during the assessment.");
    };

    const handlePaste = (event: ClipboardEvent) => {
      event.preventDefault();
      void reportEvent("paste_attempt", "Paste was blocked during the assessment.");
    };

    const handleBeforeInput = (event: InputEvent) => {
      if (event.inputType === "insertFromPaste") {
        event.preventDefault();
        void reportEvent("paste_attempt", "Paste input was blocked during the assessment.");
      }
    };

    const handleDragStart = (event: DragEvent) => event.preventDefault();

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const blocked =
        (command && ["c", "x", "v", "a", "p", "s", "u"].includes(key)) ||
        key === "printscreen";
      if (!blocked) return;

      event.preventDefault();
      const type: BrowserProctoringFlag =
        key === "c" ? "copy_attempt" :
        key === "x" ? "cut_attempt" :
        key === "v" ? "paste_attempt" :
        key === "printscreen" ? "screenshot_attempt" : "keyboard_attempt";
      const message =
        key === "c" ? "Copy shortcut was blocked during the assessment." :
        key === "x" ? "Cut shortcut was blocked during the assessment." :
        key === "v" ? "Paste shortcut was blocked during the assessment." :
        key === "printscreen" ? "Screenshot keyboard shortcut detected during the assessment." :
        "A restricted keyboard shortcut was blocked during the assessment.";
      void reportEvent(type, message);
    };

    // Page reloads are intentionally not classified as malpractice. The
    // browser navigation entry can report "reload" when the exam route is
    // entered through development/client navigation, creating false positives.

    let wasOffline = !navigator.onLine;
    const handleOnline = () => {
      if (wasOffline) {
        void reportEvent("reconnect_count", "Network reconnection detected during the assessment.");
      }
      wasOffline = false;
    };
    const handleOffline = () => { wasOffline = true; };

    const initialFullscreen = Boolean(document.fullscreenElement);
    // Read the browser fullscreen state once while registering the browser event listeners.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- DOM state synchronization
    setIsFullscreen(initialFullscreen);
    if (initialFullscreen) hasEnteredFullscreenRef.current = true;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("beforeinput", handleBeforeInput as EventListener);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("beforeinput", handleBeforeInput as EventListener);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [activeAttemptId, isSubmitted, recordBrowserEvent]);

  useEffect(() => {
    if (isSubmitted) {
      // Submission must release the browser fullscreen lock as part of the teardown lifecycle.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fullscreen teardown side effect
      void exitFullscreen();
      if (deadlineReached) {
        window.close();
      }
    }
  }, [isSubmitted, exitFullscreen, deadlineReached]);

  useEffect(() => {

    if (!cleanCode) {
      // Invalid route params must transition the page into its explicit error state.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- route validation state
      setTestLoadError("Assessment code is missing.");
      setIsLoadingTest(false);
      return;
    }

    const token = getAuthToken();

    if (!token) {
      router.replace(getLoginRedirect(cleanCode));
      return;
    }

    let cancelled = false;

    if (!activeAttemptId) {
      setTestLoadError(
        "No active server attempt was found. Please return to the lobby and start the assessment again.",
      );
      setIsLoadingTest(false);
      return;
    }

    // Local storage is only a retry draft. The backend attempt-state endpoint
    // remains authoritative when restoring the exam.
    try {
      const pendingRaw = localStorage.getItem(
        `dynoquizz_pending_submit_${activeAttemptId}`,
      );

      if (pendingRaw) {
        const pending = JSON.parse(pendingRaw);

        if (pending?.answers && typeof pending.answers === "object") {
          const pendingAnswers = normalizeAnswers(pending.answers);
          answersRef.current = pendingAnswers;
          setAnswers(pendingAnswers);
        }

        if (pending?.timeTaken && typeof pending.timeTaken === "object") {
          const pendingTimes = normalizeTimeTaken(pending.timeTaken);
          timeTakenRef.current = pendingTimes;
          setTimeTakenPerQuestion(pendingTimes);
        }
      }
    } catch {
      localStorage.removeItem(`dynoquizz_pending_submit_${activeAttemptId}`);
    }

    const loadTest = async () => {
      try {
        setIsLoadingTest(true);
        setTestLoadError(null);
        // Clear any prior route/session policy before requesting the current
        // assessment package; never carry a previous quiz's AI setting forward.
        setAiProctoringEnabled(null);

        const packageData = await api.get<QuizPackageResponse>(
          ENDPOINTS.student.quizPackageByCode(cleanCode),
          {
            retry: 2,
            retryDelayMs: 300,
            cache: "no-store",
          },
        );

        // The lobby resolves the policy from both availability and package
        // endpoints. Do not let a stale/default false from one endpoint disable
        // AI when the other endpoint explicitly requires it.
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

        const packageFlag = readProctoringFlag(packageData);
        const lobbyFlagRaw = sessionStorage.getItem(
          `dynoquizz_ai_proctoring_${cleanCode}`,
        );
        const lobbyFlag =
          lobbyFlagRaw === "true" ? true : lobbyFlagRaw === "false" ? false : undefined;

        // Enabling wins across the two student-safe sources. An explicit false
        // is accepted only when no source says that AI proctoring is required.
        const resolvedAiPolicy =
          packageFlag === true || lobbyFlag === true
            ? true
            : packageFlag === false || lobbyFlag === false
              ? false
              : undefined;

        if (typeof resolvedAiPolicy !== "boolean") {
          throw new Error(
            "The server did not confirm whether AI proctoring is required. Return to the assessment lobby and retry; if this persists, the quiz settings API must expose aiProctoringEnabled.",
          );
        }

        // The lobby is the only supported entry point for AI-proctored tests.
        // Direct navigation to /test/:code must not bypass reference-photo capture.
        if (resolvedAiPolicy && !referencePhoto) {
          throw new Error(
            "A reference photo is required for this AI-proctored assessment. Return to the assessment lobby, capture your photo, and start again.",
          );
        }

        setAiProctoringEnabled(resolvedAiPolicy);
        sessionStorage.setItem(
          `dynoquizz_ai_proctoring_${cleanCode}`,
          String(resolvedAiPolicy),
        );

        if (
          !packageData ||
          !Array.isArray(packageData.questions) ||
          packageData.questions.length === 0
        ) {
          throw new Error(
            "The server returned an empty or invalid assessment package.",
          );
        }

        const invalidQuestion = packageData.questions.find(
          (question) =>
            !Number.isFinite(Number(question.questionId)) ||
            Number(question.questionId) <= 0 ||
            !Array.isArray(question.options),
        );

        if (invalidQuestion) {
          throw new Error(
            "The assessment package contains invalid question data.",
          );
        }

        // Preserve the option labels locally while the attempt is active.
        // Historical result pages must not depend on the quiz still being
        // available through the student package endpoint after it ends.
        persistQuizOptionSnapshot(
          activeAttemptId,
          packageData.quizId,
          packageData,
        );
        // Save scoring rules alongside the local answer draft so the result
        // page can accurately recover a sheet if the server finalizes first.
        persistAttemptDraft(
          activeAttemptId,
          answersRef.current,
          timeTakenRef.current,
          buildAttemptScoringSnapshot(packageData),
        );

        if (activeAttemptId) {
          try {
            const serverState = await api.get<AttemptStateResponse>(
              ENDPOINTS.student.attemptState(activeAttemptId),
              { retry: 2, retryDelayMs: 300, cache: "no-store" },
            );

            if (!cancelled && serverState) {
              if (Number(serverState.quizId) !== Number(packageData.quizId)) {
                throw new Error(
                  "The active server attempt does not belong to this assessment.",
                );
              }

              if (serverState.status !== "IN_PROGRESS") {
                setIsSubmitted(true);
                cleanupAttemptRuntimeState(activeAttemptId, cleanCode, { preservePendingSubmitDraft: serverState.status === "AUTO_SUBMITTED" });

                if (serverState.status === "AUTO_SUBMITTED") {
                  setDeadlineNotice(
                    "The server has already automatically submitted this assessment attempt.",
                  );
                }
              }

              if (serverState.effectiveDeadline) {
                setEffectiveDeadline(serverState.effectiveDeadline);
              }

              if (Array.isArray(serverState.answers)) {
                const serverAnswers =
                  serverState.answers.reduce<ActiveAnswerState>(
                    (accumulator, answer) => {
                      const questionId = Number(answer.questionId);

                      if (
                        Number.isFinite(questionId) &&
                        questionId > 0 &&
                        Array.isArray(answer.selectedOptionIds)
                      ) {
                        accumulator[questionId] = answer.selectedOptionIds
                          .map(Number)
                          .filter((id) => Number.isFinite(id) && id > 0);
                      }

                      return accumulator;
                    },
                    {},
                  );

                const mergedAnswers = {
                  ...answersRef.current,
                  ...serverAnswers,
                };

                answersRef.current = mergedAnswers;
                setAnswers(mergedAnswers);

                const serverTimeTaken =
                  serverState.answers.reduce<Record<number, number>>(
                    (accumulator, answer) => {
                      const questionId = Number(answer.questionId);
                      const seconds = Number(answer.responseTimeSeconds ?? 0);

                      if (
                        Number.isFinite(questionId) &&
                        questionId > 0 &&
                        Number.isFinite(seconds) &&
                        seconds >= 0
                      ) {
                        accumulator[questionId] = Math.floor(seconds);
                      }

                      return accumulator;
                    },
                    {},
                  );

                const mergedTimeTaken = {
                  ...timeTakenRef.current,
                  ...serverTimeTaken,
                };

                timeTakenRef.current = mergedTimeTaken;
                setTimeTakenPerQuestion(mergedTimeTaken);
              }

              const serverQuestion = Number(serverState.currentQuestion ?? 0);

              if (
                Number.isInteger(serverQuestion) &&
                serverQuestion >= 1 &&
                serverQuestion <= packageData.questions.length
              ) {
                currentIndexRef.current = serverQuestion - 1;
                setCurrentIndex(serverQuestion - 1);
              }
            }
          } catch (error) {
            if (error instanceof ApiClientError && error.status === 401) {
              throw error;
            }

            throw new Error(
              getErrorMessage(
                error,
                "Unable to verify the server attempt state. Please return to the lobby and try again.",
              ),
            );
          }
        }

        if (!cancelled) {
          setTest(packageData);
        }
      } catch (error) {
        console.error("[Assessment Package] Load failed:", error);

        if (!cancelled) {
          if (error instanceof ApiClientError && error.status === 401) {
            router.replace(getLoginRedirect(cleanCode));
            return;
          }

          setTest(null);
          setTestLoadError(
            getErrorMessage(
              error,
              "Unable to load the assessment package. Please return to the lobby and try again.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTest(false);
        }
      }
    };

    void loadTest();

    return () => {
      cancelled = true;
    };
  }, [cleanCode, activeAttemptId, referencePhoto, router]);

  useEffect(() => {
    if (!currentQuestion || isSubmitted) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimeTakenPerQuestion((previous) => {
        const next = {
          ...previous,
          [questionId]: (previous[questionId] ?? 0) + 1,
        };

        timeTakenRef.current = next;
        return next;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentQuestion, isSubmitted]);
  const persistCurrentState = (
    nextAnswers: ActiveAnswerState = answersRef.current,
    nextTimeTaken: Record<number, number> = timeTakenRef.current,
  ) => {
    persistAttemptDraft(
      activeAttemptId,
      nextAnswers,
      nextTimeTaken,
      buildAttemptScoringSnapshot(test),
    );
  };

  const setCurrentAnswers = (next: ActiveAnswerState) => {
    answersRef.current = next;
    setAnswers(next);
    persistCurrentState(next, timeTakenRef.current);
  };

  const handleSelectOption = (optionId: number) => {
    if (!currentQuestion || isSubmitted || timeLeft <= 0 || isInteractionLockedNow()) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);
    const safeOptionId = Number(optionId);

    if (
      !Number.isFinite(questionId) ||
      questionId <= 0 ||
      !Number.isFinite(safeOptionId) ||
      safeOptionId <= 0
    ) {
      return;
    }

    const currentSelections = answersRef.current[questionId] ?? [];
    const isMultiSelect = currentQuestion.questionType === "MSQ";

    let nextSelections: number[];

    if (isMultiSelect) {
      if (currentSelections.includes(safeOptionId)) {
        nextSelections = currentSelections.filter((id) => id !== safeOptionId);
      } else {
        nextSelections = [...currentSelections, safeOptionId];
      }
    } else {
      nextSelections = [safeOptionId];
    }

    const nextAnswers: ActiveAnswerState = {
      ...answersRef.current,
      [questionId]: nextSelections,
    };

    setCurrentAnswers(nextAnswers);
  };

  const toggleReview = () => {
    if (!currentQuestion || isSubmitted || isInteractionLockedNow()) {
      return;
    }

    if (timeLeft <= 0) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    if (test?.allowReview === false) {
      return;
    }

    const next = {
      ...markedForReview,
      [questionId]: !markedForReview[questionId],
    };

    setMarkedForReview(next);
    persistCurrentState(answersRef.current, timeTakenRef.current);
  };

  const clearCurrentAnswer = () => {
    if (!currentQuestion || isSubmitted || timeLeft <= 0 || isInteractionLockedNow()) {
      return;
    }

    const questionId = Number(currentQuestion.questionId);

    if (!Number.isFinite(questionId) || questionId <= 0) {
      return;
    }

    const nextAnswers = {
      ...answersRef.current,
      [questionId]: [],
    };

    setCurrentAnswers(nextAnswers);
  };

  const goToQuestion = (nextIndex: number) => {
    if (
      nextIndex < 0 ||
      nextIndex >= questions.length ||
      isSubmitted ||
      isInteractionLockedNow()
    ) {
      return;
    }

    if (nextIndex < currentIndex && test?.allowReview === false) {
      return;
    }

    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);

  };

  const finishAssessment = useCallback(async (
    latestAnswers: ActiveAnswerState = answersRef.current,
    latestTimeTaken: Record<number, number> = timeTakenRef.current,
    allowWhileProctoringBlocked = false,
  ) => {
    const attemptId = activeAttemptId;

    if (proctoring.serverAutoSubmitted) {
      return;
    }

    if (
      aiProctoringEnabled &&
      isInteractionLockedNow() &&
      !allowWhileProctoringBlocked
    ) {
      setSubmissionNotice(
        proctoring.identityHold
          ? "Submission is paused while the proctoring service re-verifies your identity."
          : "Submission is paused until secure proctoring is ready.",
      );
      return;
    }

    if (
      submissionInFlightRef.current ||
      isSubmitted ||
      isSubmitting ||
      !test ||
      !attemptId
    ) {
      if (!attemptId && !isSubmitted) {
        setSubmissionNotice(
          "Your server attempt is missing. Your answers remain stored locally; return to the lobby to initialize the attempt again.",
        );
      }
      return;
    }

    submissionInFlightRef.current = true;
    setSubmissionStarted(true);
    setIsSubmitting(true);
    setSubmissionNotice(null);

    persistAttemptDraft(
      activeAttemptId,
      latestAnswers,
      latestTimeTaken,
      buildAttemptScoringSnapshot(test),
    );

    try {
      const completeAnswers = questions.map((question) => {
        const questionId = Number(question.questionId);

        return {
          questionId,
          selectedOptionIds: (latestAnswers[questionId] ?? []).filter(
            (optionId) =>
              Number.isFinite(Number(optionId)) && Number(optionId) > 0,
          ),
          responseTimeSeconds: Math.max(
            0,
            Math.floor(latestTimeTaken[questionId] ?? 0),
          ),
        };
      });

      const payload = {
        answers: completeAnswers,
      };

      const result = await api.post<SubmitAttemptResponse>(
        ENDPOINTS.student.submitAttempt(attemptId),
        payload,
      );

      const returnedAttemptId =
        result?.attemptId != null ? String(result.attemptId) : "";

      if (!returnedAttemptId) {
        throw new Error(
          "The server accepted the submission but did not return an attempt ID.",
        );
      }
      setIsSubmitted(true);

      cleanupAttemptRuntimeState(attemptId, cleanCode);

      if (result.status === "AUTO_SUBMITTED") {
        setDeadlineNotice(
          "The server deadline was reached, so the attempt was automatically submitted.",
        );
      }

      /*
       * The backend response can contain a score, but result visibility is
       * controlled independently by quiz publication settings. The result
       * page remains the source of truth for whether results are available.
       */
      if (result.finalScore == null) {
        setSubmissionNotice(
          "Submitted successfully. Results will be available once published.",
        );
      }
    } catch (error) {
      setIsSubmitted(false);

      if (error instanceof ApiClientError && error.status === 409) {
        try {
          const state = await api.get<AttemptStateResponse>(
            ENDPOINTS.student.attemptState(attemptId),
            { retry: 2, retryDelayMs: 300, cache: "no-store" },
          );

          if (state.status !== "IN_PROGRESS") {
            setIsSubmitted(true);

            // A proctoring event may have auto-submitted the attempt on the
            // server before the browser's normal submit request completed.
            // Reconcile local navigation state with that authoritative result.
            cleanupAttemptRuntimeState(attemptId, cleanCode, { preservePendingSubmitDraft: state.status === "AUTO_SUBMITTED" });

            if (state.status === "AUTO_SUBMITTED") {
              setDeadlineNotice(
                "The server has already automatically submitted this assessment attempt.",
              );
            }
            // A deadline/proctoring finalization can win the race with the
            // answer-sheet request. Keep its local draft and go straight to
            // results so the result page can recover the saved selections.
            void proctoringCleanupRef.current();
            router.replace(`/dashboard/student/result/${attemptId}`);
            return;
          }
        } catch (reconcileError) {
          console.warn(
            "[Assessment Submission] Could not reconcile attempt state:",
            reconcileError,
          );
        }
      }

      if (error instanceof ApiClientError && error.status === 409) {
        // We tried to submit an attempt that the server still reports as
        // active. Surface a recoverable message without triggering Next's
        // development error overlay for an expected API conflict.
        console.warn("[Assessment Submission] Server rejected a duplicate/stale submission (409).");
      } else {
        console.error("[Assessment Submission] Failed:", error);
      }

      if (error instanceof ApiClientError && error.status === 401) {
        setSessionExpired(true);
      } else {
        setSubmissionNotice(
          getErrorMessage(
            error,
            "Submission failed. Your unsent answers are kept locally for retry. The server attempt remains authoritative.",
          ),
        );
      }
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    activeAttemptId,
    aiProctoringEnabled,
    cleanCode,
    isInteractionLockedNow,
    isSubmitted,
    isSubmitting,
    proctoring.identityHold,
    proctoring.serverAutoSubmitted,
    questions,
    test,
  ]);

  // Keep the latest submission callback available to asynchronous AI warning handlers.
  useEffect(() => {
    finishAssessmentRef.current = finishAssessment;
  }, [finishAssessment]);

  const handleOverallTimerExpired = useCallback(() => {
    if (
      expiryHandledRef.current ||
      isSubmitted ||
      !activeAttemptId ||
      !test
    ) {
      return;
    }

    expiryHandledRef.current = true;
    setTimeLeft(0);
    setDeadlineReached(true);
    setDeadlineNotice(null);

    // Reuse the same single-flight submission path as manual submission.
    // It marks the UI submitted immediately, then sends the complete answer
    // sheet to the backend. The backend remains authoritative and will return
    // AUTO_SUBMITTED because the deadline has been reached.
    void finishAssessment(
      { ...answersRef.current },
      { ...timeTakenRef.current },
      true,
    );
  }, [activeAttemptId, finishAssessment, isSubmitted, test]);

  useEffect(() => {
    if (isSubmitted || !effectiveDeadline) {
      return;
    }

    const deadlineMs = parseBackendDeadline(effectiveDeadline);

    if (!Number.isFinite(deadlineMs)) {
      // This validation follows a server response and must block the assessment on invalid data.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- server response validation
      setTestLoadError(
        "The server returned an invalid assessment deadline. Please return to the lobby and start the assessment again.",
      );
      return;
    }

    expiryHandledRef.current = false;

    const updateCountdown = () => {
      const remainingSeconds = Math.max(
        0,
        Math.ceil((deadlineMs - Date.now()) / 1000),
      );

      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        handleOverallTimerExpired();
      }
    };

    updateCountdown();

    const interval = window.setInterval(updateCountdown, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updateCountdown();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [effectiveDeadline, handleOverallTimerExpired, isSubmitted]);

  useEffect(() => {
    if (!activeAttemptId) {
      return;
    }

    const flush = () => {
      persistAttemptDraft(
        activeAttemptId,
        answersRef.current,
        timeTakenRef.current,
      );
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [activeAttemptId]);

  if (sessionExpired) {
    const allowResume = test?.allowResume !== false;

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-4 font-sans text-[#111111] dark:bg-slate-950 dark:text-slate-100">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          className="w-full max-w-md space-y-4 rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900 md:p-8"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-[#fbeee8] text-[#8c381c] shadow-xs dark:border-slate-700 dark:bg-rose-950/70 dark:text-rose-200">
            <AlertTriangle className="h-6 w-6 text-[#8c381c]" />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b] dark:text-slate-400">
              Authentication Notice
            </span>

            <h1 className="text-lg font-bold text-[#111111] dark:text-slate-100">
              Session Expired Mid-Assessment
            </h1>

            <p className="text-xs font-medium leading-relaxed text-[#78716b] dark:text-slate-400">
              {allowResume
                ? "Your authentication session has expired. Unsynced answers are preserved locally for retry. Log in again to resume the server attempt."
                : "Your authentication session has expired. This assessment does not permit resumption."}
            </p>
          </div>

          {allowResume ? (
            <Link
              href={getLoginRedirect(cleanCode)}
              className="flex items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              Log In to Resume
            </Link>
          ) : (
            <Link
              href="/dashboard/student"
              className="flex items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 px-4 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              Return to Dashboard
            </Link>
          )}
        </motion.div>
      </main>
    );
  }

  if (isSubmitted || deadlineReached || submissionStarted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-4 font-sans text-[#111111] dark:bg-slate-950 dark:text-slate-100">
        <motion.div
          initial={mounted ? { opacity: 0, y: 8 } : false}
          animate={mounted ? { opacity: 1, y: 0 } : false}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-md space-y-4 rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900 md:p-8"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-[#e2ede8] text-[#1d5237] dark:border-slate-700 dark:bg-emerald-950/70 dark:text-emerald-200">
            <CheckCircle2 className="h-6 w-6 text-[#1d5237]" />
          </div>
          <h1 className="text-xl font-bold text-[#111111] dark:text-slate-100">
            {isSubmitted
              ? "Exam Submitted"
              : submissionNotice
                ? "Submission Needs Attention"
                : "Submitting Assessment"}
          </h1>
          {!isSubmitted && !submissionNotice && (
            <p className="text-xs font-medium leading-relaxed text-[#78716b] dark:text-slate-400">
              Your submission is being processed. You can return to the dashboard while it completes.
            </p>
          )}
          {submissionNotice && !isSubmitted && (
            <>
              <p className="text-xs font-medium leading-relaxed text-[#8c381c] dark:text-rose-200">
                Submission could not be confirmed.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmissionNotice(null);
                  expiryHandledRef.current = false;
                  void finishAssessment(
                    { ...answersRef.current },
                    { ...timeTakenRef.current },
                  );
                }}
                disabled={isSubmitting || examInteractionBlocked}
                className="w-full rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                Retry Submission
              </button>
            </>
          )}
          <Link
            href="/dashboard/student"
            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
          >
            Return to Dashboard
            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </main>
    );
  }

  if (isLoadingTest) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-4 font-sans text-[#111111] dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-[#f5f5f4] text-[#165dfb] dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
            <Clock className="h-6 w-6 animate-pulse" />
          </div>

          <h1 className="text-xl font-bold text-[#111111] dark:text-slate-100">
            Loading Assessment
          </h1>

          <p className="text-xs font-medium leading-relaxed text-[#78716b] dark:text-slate-400">
            Preparing your secure assessment package.
          </p>
        </div>
      </main>
    );
  }

  if (testLoadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-4 font-sans text-[#111111] dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-[#fbeee8] text-[#8c381c] dark:border-slate-700 dark:bg-rose-950/70 dark:text-rose-200">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-[#111111] dark:text-slate-100">
            Assessment Could Not Be Loaded
          </h1>

          <p className="text-xs font-medium leading-relaxed text-[#78716b] dark:text-slate-400">
            {testLoadError}
          </p>

          <Link
            href={`/test/${cleanCode}/lobby`}
            className="flex w-full items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
          >
            Return to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

  if (!test || questions.length === 0 || !activeAttemptId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] p-4 font-sans text-[#111111] dark:bg-slate-950 dark:text-slate-100">
        <div className="w-full max-w-md space-y-4 rounded-[14px] border border-[#d1dee8]/70 bg-white p-8 text-center shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#d1dee8]/70 bg-[#fbeee8] text-[#165dfb] dark:border-slate-700 dark:bg-rose-950/70 dark:text-rose-200">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-[#111111] dark:text-slate-100">
            Assessment Session Not Found
          </h1>

          <p className="text-xs font-medium leading-relaxed text-[#78716b] dark:text-slate-400">
            No valid active server attempt was found for{" "}
            <strong>&ldquo;{cleanCode}&rdquo;</strong>. Please return to the
            lobby and start the assessment again.
          </p>

          <Link
            href={`/test/${cleanCode}/lobby`}
            className="flex w-full items-center justify-center rounded-[10px] bg-[#165dfb] py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
          >
            Back to Assessment Lobby
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div
      className="relative flex h-[100dvh] w-screen overflow-hidden bg-[#f5f5f4] p-0 font-sans text-[#111111] select-none dark:bg-slate-950 dark:text-slate-100"
      style={{ WebkitUserSelect: "none", userSelect: "none" }}
    >
      <AnimatePresence>
        {browserNotice && (
          <motion.div
            key={browserNotice.id}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="status"
            aria-live="assertive"
            className="pointer-events-auto fixed right-3 top-3 z-[120] flex w-[min(24rem,calc(100vw-1.5rem))] items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-rose-950 shadow-xl dark:border-amber-700/70 dark:bg-slate-900 dark:text-slate-100 sm:right-5 sm:top-5"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-amber-950/70 dark:text-amber-300">
              {browserNotice.type === "tab_switch" ? (
                <AppWindow className="h-5 w-5" />
              ) : browserNotice.type === "fullscreen_exit" ? (
                <Maximize2 className="h-5 w-5" />
              ) : (
                <ShieldAlert className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block text-xs font-extrabold">{browserNotice.title}</strong>
              <span className="mt-1 block break-words text-[10px] leading-relaxed opacity-85">
                {browserNotice.message}
              </span>
              {browserNotice.policyCount != null && (
                <span className="mt-1.5 block text-[10px] font-bold">
                  Browser violations detected: {browserNotice.policyCount}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setBrowserNotice(null)}
              aria-label="Dismiss browser activity notification"
              className="ml-1 rounded-md px-1.5 py-0.5 text-xs font-bold opacity-70 transition hover:bg-rose-200 hover:opacity-100 dark:hover:bg-slate-700"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {!isFullscreen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111111]/70 p-4 backdrop-blur-sm dark:bg-black/80">
          <div className="w-full max-w-md rounded-[16px] border border-[#d1dee8] bg-white p-6 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] text-[#8c381c] dark:bg-rose-950/70 dark:text-rose-200">
              <Maximize2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-black text-[#111111] dark:text-slate-100">
              Fullscreen Required
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#78716b] dark:text-slate-300">
              The assessment must remain in fullscreen mode. Re-enter fullscreen to continue the attempt.
            </p>
            {violationCount > 0 && (
              <p className="mt-2 text-[10px] font-bold text-[#8c381c] dark:text-rose-200">
                Activity flags: {violationCount}
              </p>
            )}
            <button
              type="button"
              onClick={() => void requestFullscreen()}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#111111] px-5 py-2.5 text-xs font-bold text-white transition-all hover:bg-[#222222] active:scale-[0.98] dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex h-full min-w-0 flex-1 flex-col overflow-hidden border-0 bg-white text-left shadow-none dark:bg-slate-900"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d1dee8]/50 bg-white px-3 py-3 sm:px-6 sm:py-4 dark:border-slate-700 dark:bg-slate-950">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <span className="rounded-full border border-[#d1dee8]/70 bg-[#f5f5f4] px-3 py-1 font-mono text-xs font-bold text-[#165dfb] dark:border-slate-700 dark:bg-slate-800 dark:text-blue-300">
              {cleanCode}
            </span>

            <span className="text-xs font-bold text-[#78716b] dark:text-slate-300">
              Question {currentIndex + 1} of {questions.length}
            </span>

            {markedForReview[Number(currentQuestion?.questionId)] && (
              <span className="flex items-center gap-1 rounded-full bg-[#f6efe1] px-2 py-1 text-[10px] font-bold text-[#73561a] dark:border dark:border-amber-700/60 dark:bg-amber-950/70 dark:text-amber-200">
                <Flag className="h-3 w-3" />
                Marked for review
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            <div className="flex items-center gap-2">
              <div
                className={
                  "flex items-center gap-1.5 rounded-full px-3 py-1 font-bold text-xs border " +
                  (timeLeft <= 10
                    ? "bg-[#fbeee8] text-[#8c381c] border-[#8c381c]/30 animate-pulse dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-800"
                    : "bg-[#f5f5f4] text-[#78716b] border-[#d1dee8]/70 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700")
                }
                title="Overall server-authoritative assessment deadline"
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Time Remaining: </span><span className="sm:hidden">Time </span>{formatRemainingTime(timeLeft)}
              </div>
            </div>
          </div>
        </header>

        <div className="h-1.5 w-full border-b border-[#d1dee8]/30 bg-[#e6e3e2]/40 dark:border-slate-800 dark:bg-slate-800">
          <div
            className="h-full bg-[#165dfb] transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>


        <div className="border-b border-[#d1dee8]/50 bg-[#f8f8f7] px-3 py-3 dark:border-slate-700 dark:bg-slate-900 sm:px-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#57534e] dark:text-slate-300">
              Question Navigator
            </span>
            <span className="text-[10px] font-semibold text-[#57534e] dark:text-slate-400">
              {currentIndex + 1} of {questions.length}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[9px] font-semibold sm:gap-4 sm:text-[10px]" aria-label="Question status legend">
            <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-sm border border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/70" />
              Answered {answeredQuestionCount}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" />
              Unanswered {unansweredQuestionCount}
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <Flag className="h-3 w-3" />
              Marked {markedQuestionCount}
            </span>
          </div>

          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1.5" aria-label="Questions">
            {questions.map((question, index) => {
              const questionId = Number(question.questionId);
              const answered = (answers[questionId] ?? []).length > 0;
              const marked = markedForReview[questionId] === true;
              const isCurrent = index === currentIndex;
              const statusLabel = answered ? "Answered" : "Unanswered";
              const accessibleLabel = `Question ${index + 1}, ${statusLabel}${marked ? ", marked for review" : ""}${isCurrent ? ", current question" : ""}`;

              return (
                <button
                  key={questionId}
                  type="button"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={accessibleLabel}
                  title={accessibleLabel}
                  onClick={() => goToQuestion(index)}
                  disabled={
                    isSubmitted ||
                    examInteractionBlocked ||
                    (test?.allowReview === false && index < currentIndex)
                  }
                  className={`relative flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border px-2 text-[10px] font-extrabold tabular-nums transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-slate-900 ${
                    answered
                      ? `border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200 ${isCurrent ? "ring-2 ring-[#165dfb] ring-offset-1 dark:ring-offset-slate-900" : ""}`
                      : marked
                        ? `border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200 ${isCurrent ? "ring-2 ring-[#165dfb] ring-offset-1 dark:ring-offset-slate-900" : ""}`
                        : `border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 ${isCurrent ? "border-[#165dfb] ring-2 ring-[#165dfb] ring-offset-1 dark:ring-offset-slate-900" : ""}`
                  }`}
                >
                  {index + 1}
                  {marked && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-amber-500 text-white shadow-sm dark:border-slate-900">
                      <Flag className="h-2 w-2" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {submissionNotice && !isSubmitted && (
          <div className="border-b border-[#8c381c]/20 bg-[#fff8f5] px-4 py-3 dark:border-rose-900/70 dark:bg-rose-950/40 md:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs font-semibold text-[#8c381c] dark:text-rose-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submissionNotice}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  void finishAssessment(
                    { ...answersRef.current },
                    { ...timeTakenRef.current },
                  )
                }
                disabled={isSubmitting}
                className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[#8c381c] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#6e2b14] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Retry Submission"}
              </button>
            </div>
          </div>
        )}

        {deadlineNotice && !isSubmitted && (
          <div className="border-b border-[#73561a]/20 bg-[#f6efe1] px-4 py-3 dark:border-amber-800/70 dark:bg-amber-950/40 md:px-6">
            <div className="flex items-start gap-2 text-xs font-semibold text-[#73561a] dark:text-amber-200">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{deadlineNotice}</span>
            </div>
          </div>
        )}

        {!isFullscreen && (
          <div className="border-b border-[#8c381c]/20 bg-[#fbeee8] px-4 py-3 dark:border-rose-900/70 dark:bg-rose-950/40 md:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-xs text-[#8c381c] dark:text-rose-200">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong className="font-bold">Fullscreen mode is off.</strong>
                  <p className="mt-0.5 font-medium dark:text-rose-200">
                    Re-enter fullscreen before continuing the assessment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void requestFullscreen()}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#8c381c]/30 bg-white px-3 py-2 text-[10px] font-bold text-[#8c381c] transition-all hover:bg-[#fffaf8] dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-slate-800"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Enter Fullscreen
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-5 dark:bg-slate-900 sm:px-6 sm:py-6 md:px-10 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={`q-${currentIndex}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold leading-snug tracking-tight text-[#111111] dark:text-slate-100 md:text-xl">
                  {currentQuestion?.questionText}
                </h2>
              </div>

              <div className="mb-5 text-[11px] font-semibold text-[#78716b] dark:text-slate-400">
                {currentQuestion?.questionType === "MSQ"
                  ? "Select all correct options."
                  : "Select one option."}
              </div>

              <div className="space-y-2.5">
                {currentQuestion?.options.map((option, idx) => {
                  const optionId = Number(option.optionId);
                  const selectedIds =
                    answers[Number(currentQuestion.questionId)] ?? [];
                  const isSelected = selectedIds.includes(optionId);

                  return (
                    <button
                      key={optionId || idx}
                      type="button"
                      onClick={() => handleSelectOption(optionId)}
                      disabled={
                        isSubmitted ||
                        examInteractionBlocked ||
                        timeLeft <= 0
                      }
                      className={`w-full rounded-[10px] border p-3.5 text-left text-xs font-bold transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                        isSelected
                          ? "border-[#165dfb] bg-[#165dfb]/5 text-[#111111] ring-2 ring-[#165dfb]/20 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-100 dark:ring-blue-400/30"
                          : "border-[#d1dee8]/70 bg-white text-[#57534e] hover:border-[#165dfb]/40 hover:text-[#111111] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-[8px] text-xs font-bold border ${
                            isSelected
                              ? "bg-[#165dfb] border-[#165dfb] text-white dark:bg-blue-500 dark:border-blue-400"
                              : "bg-[#f5f5f4] text-[#57534e] border-[#d1dee8]/70 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600"
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>

                        <span className="flex-1">{option.optionText}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="relative z-40 border-t border-[#d1dee8]/70 bg-white px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-slate-700 dark:bg-slate-900 sm:px-6 sm:py-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={
                  isSubmitted ||
                  examInteractionBlocked ||
                  currentIndex === 0 ||
                  test?.allowReview === false
                }
                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-[#d1dee8]/80 bg-white px-2 py-2.5 text-[10px] font-bold text-[#111111] transition-all hover:bg-[#f5f5f4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:px-3"
              >
                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                <span>Previous</span>
              </button>

              <button
                type="button"
                onClick={toggleReview}
                disabled={isSubmitted || examInteractionBlocked || test?.allowReview === false}
                aria-pressed={markedForReview[Number(currentQuestion?.questionId)] === true}
                className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-[10px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 ${
                  markedForReview[Number(currentQuestion?.questionId)]
                    ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-200"
                    : "border-[#d1dee8]/80 bg-white text-[#57534e] hover:bg-[#f5f5f4] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <Flag className="h-3.5 w-3.5 shrink-0" />
                <span className="sm:hidden">{markedForReview[Number(currentQuestion?.questionId)] ? "Marked" : "Review"}</span>
                <span className="hidden sm:inline">{markedForReview[Number(currentQuestion?.questionId)] ? "Marked" : "Mark Review"}</span>
              </button>

              <button
                type="button"
                onClick={clearCurrentAnswer}
                disabled={
                  isSubmitted ||
                  examInteractionBlocked ||
                  (answers[Number(currentQuestion?.questionId)] ?? []).length === 0
                }
                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-[#d1dee8]/80 bg-white px-2 py-2.5 text-[10px] font-bold text-[#57534e] transition-all hover:bg-[#f5f5f4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>Clear</span>
              </button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (currentIndex < questions.length - 1) {
                    goToQuestion(currentIndex + 1);
                  } else {
                    void finishAssessment(answersRef.current, timeTakenRef.current);
                  }
                }}
                disabled={isSubmitted || isSubmitting || examInteractionBlocked}
                className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg bg-[#165dfb] px-3 py-2.5 text-xs font-bold text-white shadow-xs transition-all hover:bg-[#0f4fd8] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
              >
                {currentIndex === questions.length - 1 ? (
                  <>
                    <span className="sm:hidden">{isSubmitting ? "Submitting..." : "Submit"}</span>
                    <span className="hidden sm:inline">{isSubmitting ? "Submitting..." : "Submit Assessment"}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Next</span>
                    <span className="hidden sm:inline">Next Question</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileProctoringOpen((open) => !open)}
                aria-label="Open browser monitoring panel"
                aria-expanded={mobileProctoringOpen}
                aria-controls="mobile-proctoring-panel"
                title="Open browser monitoring"
                className="relative inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#d1dee8]/80 bg-white px-2.5 text-[10px] font-bold text-[#57534e] transition-colors hover:bg-[#f5f5f4] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3 lg:hidden"
              >
                <Activity className="h-3.5 w-3.5 shrink-0" />
                <span>Monitor</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold tabular-nums ${
                  violationCount > 0
                    ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                }`}>{violationCount}</span>
              </button>
            </div>
          </div>
        </footer>
      </motion.div>

      <aside
        id="mobile-proctoring-panel"
        aria-label="Assessment monitoring panel"
        className={`fixed bottom-[calc(8.25rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 flex-col gap-3 overflow-y-auto rounded-xl border border-[#d1dee8]/80 bg-white/95 p-2 text-left shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95 max-h-[36dvh] sm:max-h-[40dvh] ${
          mobileProctoringOpen ? "flex" : "hidden"
        } lg:static lg:flex lg:h-full lg:max-h-[100dvh] lg:w-80 lg:shrink-0 lg:overflow-y-auto lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:py-4 lg:pl-4 lg:pr-4 lg:shadow-none lg:backdrop-blur-none`}
      >
        <div className="flex items-center justify-between gap-2 px-1 py-1 lg:hidden">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            {aiProctoringEnabled ? "Monitoring & proctoring" : "Browser monitoring"}
          </span>
          <button
            type="button"
            onClick={() => setMobileProctoringOpen(false)}
            className="rounded-md px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <BrowserActivityPanel
          flags={flags}
          warnings={warnings}
          violationCount={violationCount}
          restoredFromSession={browserActivityRestored}
        />

        {aiProctoringEnabled && (
          <AIProctoringHUD
            videoRef={proctoring.videoRef}
            cameraActive={proctoring.cameraActive}
            cameraError={proctoring.cameraError}
            telemetryReceived={proctoring.telemetryReceived}
            faceDetected={proctoring.faceDetected}
            numFaces={proctoring.numFaces}
            numPersons={proctoring.numPersons}
            identityVerified={proctoring.identityVerified}
            similarityScore={proctoring.similarityScore}
            gazeDirection={proctoring.gazeDirection}
            yaw={proctoring.yaw}
            pitch={proctoring.pitch}
            isLookingAway={proctoring.isLookingAway}
            phoneDetected={proctoring.phoneDetected}
            micLevel={proctoring.micLevel}
            voiceActive={proctoring.voiceActive}
            loudVoice={proctoring.loudVoice}
            warningCount={proctoring.warningCount}
            isOnline={proctoring.isOnline}
          />
        )}
      </aside>

      {aiProctoringEnabled &&
        !isSubmitted &&
        activeAttemptId &&
        !isAIProctoringReady &&
        !proctoring.cameraError &&
        !proctoring.identityHold &&
        !proctoring.serverAutoSubmitted && (
          <div className="fixed right-4 top-4 z-[80] flex max-w-xs items-center gap-2 rounded-lg border border-[#d1dee8] bg-white/95 px-3 py-2 text-xs text-[#57534e] shadow-sm" role="status" aria-live="polite">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#165dfb]" />
            Preparing secure proctoring…
          </div>
        )}

      {aiProctoringEnabled && !isSubmitted && activeAttemptId && !isAIProctoringReady && proctoring.cameraError && (
        <div role="dialog" aria-modal="true" aria-live="assertive" aria-label="AI proctoring validation failed" className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111111]/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-[16px] border border-[#d1dee8] bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fbeee8] text-[#8c381c] dark:bg-rose-950/70 dark:text-rose-200"><AlertTriangle className="h-6 w-6" /></div>
            <h2 className="text-lg font-extrabold text-[#111111]">AI Proctoring Could Not Validate You</h2>
            <p className="text-xs leading-relaxed text-[#8c381c]">{proctoring.cameraError}</p>
            <p className="text-xs leading-relaxed text-[#78716b]">
              The assessment remains locked. Return to the lobby to capture a fresh reference photo. The previously rejected image will not be reused.
            </p>
            <button
              type="button"
              onClick={() => {
                void proctoring.cleanup();
                sessionStorage.removeItem("dynoquizz_reference_photo");
                void exitFullscreen();
                router.replace(`/test/${encodeURIComponent(cleanCode)}/lobby`);
              }}
              className="w-full rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f4fd8]"
            >
              Return to Lobby &amp; Capture Fresh Photo
            </button>
          </div>
        </div>
      )}

      {aiProctoringEnabled &&
        !isSubmitted &&
        activeAttemptId &&
        proctoring.identityHold &&
        !proctoring.cameraError &&
        !proctoring.serverAutoSubmitted && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-label="Identity verification hold"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[#111111]/80 p-4 backdrop-blur-sm"
          >
            <div className="w-full max-w-lg space-y-4 rounded-[16px] border border-amber-200 bg-white p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-extrabold text-[#111111]">
                {proctoring.telemetryReceived
                  ? "Identity Verification On Hold"
                  : "Verifying Registered Student"}
              </h2>
              <p className="text-sm font-semibold leading-relaxed text-amber-800">
                {describeIdentityHoldReason(proctoring.identityHoldReason)}
              </p>
              <div className="rounded-[12px] border border-amber-100 bg-amber-50 p-4 text-left text-xs leading-relaxed text-amber-950">
                Your answers cannot be changed, questions cannot be navigated, and you cannot submit while identity verification is on hold. Keep the camera active; frames continue to be sent so the backend can re-check the registered student.
              </div>
              <div className="grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
                {[
                  ["Camera", proctoring.cameraActive ? "Active" : "Waiting"],
                  ["Faces", String(proctoring.numFaces)],
                  ["People", String(proctoring.numPersons)],
                  ["Warnings", String(proctoring.warningCount)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[9px] border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[#78716b]">{label}</p>
                    <p className="mt-1 text-xs font-extrabold text-[#111111]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      <ProctoringWarningModal
        isOpen={proctoring.activeWarningModal.isOpen}
        warningCount={Math.max(
          proctoring.warningCount,
          proctoring.activeWarningModal.count,
        )}
        reason={proctoring.activeWarningModal.reason}
        autoSubmitted={proctoring.activeWarningModal.autoSubmitted}
        faceDetected={proctoring.faceDetected}
        onAcknowledge={() => {
          proctoring.dismissWarningModal();
          if (proctoring.activeWarningModal.autoSubmitted) {
            sessionStorage.removeItem(`dynoquizz_pending_proctor_attempt_${cleanCode}`);
            sessionStorage.removeItem(`dynoquizz_reference_photo_fresh_${activeAttemptId}`);
            sessionStorage.removeItem("dynoquizz_reference_photo");
            const resultAttemptId = String(activeAttemptId ?? "").trim();
            if (/^\\d+$/.test(resultAttemptId)) {
              router.replace(`/dashboard/student/result/${resultAttemptId}`);
            } else {
              // Never navigate to the result route with a quiz code. If the
              // attempt ID is unavailable, return to the student dashboard.
              router.replace("/dashboard/student");
            }
          }
        }}
      />
    </div>
  );
}