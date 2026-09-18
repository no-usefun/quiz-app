export interface QuestionScoreParams {
  isCorrect: boolean;
  isAnswered: boolean;
  timeTakenSeconds: number;
  allottedTimeSeconds: number;
  marks?: number;
  negativeMarks?: number;
  negativeMarkingEnabled?: boolean;
}

export interface QuestionScoreResult {
  score: number;
}

/**
 * Calculates a time-decay score for a single question.
 *
 * Rules:
 * - Unanswered → 0
 * - Incorrect  → negative penalty (if negative marking is on), else 0
 * - Correct    → decaying mark in range (0, baseMark].
 *
 * Decay tiers (fraction of allotted time consumed):
 *   ≤ 25%  → full mark  (1.00 × baseMark)
 *   ≤ 50%  → 0.95 × baseMark
 *   ≤ 75%  → 0.85 × baseMark
 *   > 75%  → 0.70 × baseMark
 *
 * The result is always capped at baseMark — no bonus marks are ever awarded above it.
 */
export function calculateQuestionScore(params: QuestionScoreParams): QuestionScoreResult {
  const baseMark = params.marks ?? 1;
  const neg = params.negativeMarks ?? 1;

  if (!params.isAnswered) {
    return { score: 0 };
  }

  if (!params.isCorrect) {
    const penalty = params.negativeMarkingEnabled ? -neg : 0;
    return { score: penalty };
  }

  // Correct answer — apply time-decay
  const allotted = Math.max(1, params.allottedTimeSeconds || 30);
  const timeTaken = Math.min(allotted, Math.max(0, params.timeTakenSeconds));
  const ratio = timeTaken / allotted; // 0 (instant) → 1 (full time used)

  let multiplier: number;
  if (ratio <= 0.25) {
    multiplier = 1.0;
  } else if (ratio <= 0.5) {
    multiplier = 0.95;
  } else if (ratio <= 0.75) {
    multiplier = 0.85;
  } else {
    multiplier = 0.70;
  }

  // Never exceed the base mark
  const score = Math.min(baseMark, Number((baseMark * multiplier).toFixed(2)));
  return { score };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
