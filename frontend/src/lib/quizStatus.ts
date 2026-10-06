export type QuizDisplayState =
  | "Draft"
  | "Scheduled"
  | "Live"
  | "Ended"
  | "Completed"
  | "Cancelled";

/**
 * Backend lifecycle:
 *
 * QuizStatus:
 *   DRAFT | PUBLISHED | COMPLETED | CANCELLED
 *
 * ExamState:
 *   WAITING | RUNNING | PAUSED | ENDED
 *
 * This helper is display-only. The backend remains authoritative for
 * whether a student can actually start an attempt.
 */
export function computeQuizDisplayState(q: {
  status?: string | null;
  examState?: string | null;
  startTime?: string | number | null;
  endTime?: string | number | null;
}): QuizDisplayState {
  const status = String(q.status ?? "")
    .trim()
    .toUpperCase();
  const examState = String(q.examState ?? "")
    .trim()
    .toUpperCase();

  if (status === "DRAFT") {
    return "Draft";
  }

  if (status === "COMPLETED") {
    return "Completed";
  }

  if (status === "CANCELLED") {
    return "Cancelled";
  }

  /*
   * The current backend does not use a LIVE QuizStatus.
   * Keep it accepted only as a backward-compatibility value.
   */
  if (status !== "PUBLISHED" && status !== "LIVE") {
    return "Draft";
  }

  /*
   * Backend availability is based on the published status and the
   * start/end window. For teacher UI, ExamState.ENDED also means ended.
   */
  if (examState === "ENDED") {
    return "Ended";
  }

  const now = Date.now();

  const start =
    q.startTime !== null && q.startTime !== undefined
      ? new Date(q.startTime).getTime()
      : null;

  const end =
    q.endTime !== null && q.endTime !== undefined
      ? new Date(q.endTime).getTime()
      : null;

  const hasValidStart = start !== null && Number.isFinite(start);

  const hasValidEnd = end !== null && Number.isFinite(end);

  if (hasValidStart && now < start) {
    return "Scheduled";
  }

  if (hasValidEnd && now >= end) {
    return "Ended";
  }

  /*
   * RUNNING is explicitly live.
   *
   * PAUSED is still a published assessment inside the configured
   * time window; the backend's exact state should be shown elsewhere
   * when pause-specific UI is required.
   */
  if (examState === "RUNNING") {
    return "Live";
  }

  if (hasValidStart && hasValidEnd && now >= start && now < end) {
    return "Live";
  }

  /*
   * The backend requires published quizzes to have a start/end window
   * before publishing. This fallback is only for incomplete/malformed
   * display data and must not be used as an availability decision.
   */
  if (!hasValidStart || !hasValidEnd) {
    return "Live";
  }

  return "Live";
}
