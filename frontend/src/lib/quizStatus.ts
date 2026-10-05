export type QuizDisplayState =
  | "Draft"
  | "Scheduled"
  | "Live"
  | "Ended"
  | "Completed"
  | "Cancelled";

/**
 * Computes the unified display state for a quiz based on backend status,
 * examState, startTime, and endTime.
 *
 * Rules:
 * - status DRAFT -> "Draft"
 * - status PUBLISHED and now < startTime -> "Scheduled"
 * - status PUBLISHED and examState != ENDED and now within startTime..endTime (or examState == RUNNING) -> "Live"
 * - status PUBLISHED and now > endTime, or examState ENDED -> "Ended"
 * - status COMPLETED -> "Completed"
 * - status CANCELLED -> "Cancelled"
 */
export function computeQuizDisplayState(q: {
  status?: string | null;
  examState?: string | null;
  startTime?: string | number | null;
  endTime?: string | number | null;
}): QuizDisplayState {
  const status = (q.status || "").toUpperCase();
  const examState = (q.examState || "").toUpperCase();

  if (status === "DRAFT") return "Draft";
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";

  if (status === "PUBLISHED" || status === "LIVE") {
    const now = Date.now();
    const start = q.startTime ? new Date(q.startTime).getTime() : null;
    const end = q.endTime ? new Date(q.endTime).getTime() : null;

    // 1. Scheduled if quiz start is in the future
    if (start && !isNaN(start) && now < start) {
      return "Scheduled";
    }

    // 2. Live if examState is explicitly RUNNING or now is within startTime..endTime (and examState != ENDED)
    if (
      examState === "RUNNING" ||
      (examState !== "ENDED" &&
        start &&
        end &&
        !isNaN(start) &&
        !isNaN(end) &&
        now >= start &&
        now <= end)
    ) {
      return "Live";
    }

    // 3. Ended if examState is ENDED or current time passed endTime
    if (examState === "ENDED" || (end && !isNaN(end) && now > end)) {
      return "Ended";
    }

    // Default for published if timestamps are null or missing
    return "Live";
  }

  return "Draft";
}
