/**
 * Frontend scoring contract.
 *
 * IMPORTANT:
 * The Spring Boot backend is the authoritative source for quiz scoring.
 * The frontend must not reproduce the backend's final score calculation.
 *
 * This module therefore contains:
 * - a legacy-compatible question score helper for UI previews only;
 * - duration formatting for exam timers.
 *
 * Never use calculateQuestionScore() as the submitted/final quiz score.
 * Final score, percentage, negative marking, and marks awarded come from:
 *   GET /api/v1/student/attempts/{attemptId}/result
 *   GET /api/v1/student/attempts/{attemptId}/result/details
 */

export interface QuestionScoreParams {
  isCorrect: boolean;
  isAnswered: boolean;

  /**
   * Retained for compatibility with existing callers.
   * Backend timing/scoring is authoritative and these values are not used
   * to invent a frontend time-decay formula.
   */
  timeTakenSeconds?: number;
  allottedTimeSeconds?: number;

  marks?: number;
  negativeMarks?: number;
  negativeMarkingEnabled?: boolean;
}

export interface QuestionScoreResult {
  /**
   * Basic UI preview only.
   *
   * This is NOT the authoritative attempt score returned by the backend.
   */
  score: number;

  /**
   * Explicitly identifies this value as a frontend preview.
   */
  authoritative: false;
}

/**
 * Returns a basic question-score preview for UI compatibility.
 *
 * The previous implementation applied a custom time-decay formula
 * (100% / 95% / 85% / 70%). That formula is not part of the current
 * frontend/backend contract and must not be used to calculate final results.
 *
 * The backend determines the actual marksAwarded/finalScore.
 */
export function calculateQuestionScore(
  params: QuestionScoreParams,
): QuestionScoreResult {
  if (!params.isAnswered) {
    return {
      score: 0,
      authoritative: false,
    };
  }

  const baseMarks = params.marks ?? 0;
  const negativeMarks = params.negativeMarks ?? 0;

  if (params.isCorrect) {
    return {
      score: baseMarks,
      authoritative: false,
    };
  }

  return {
    score: params.negativeMarkingEnabled ? -negativeMarks : 0,
    authoritative: false,
  };
}

/**
 * Formats a non-negative duration as MM:SS.
 *
 * This is a display helper only; the authoritative attempt deadline is
 * returned by the backend in AttemptResponse.effectiveDeadline.
 */
export function formatDuration(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;

  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
