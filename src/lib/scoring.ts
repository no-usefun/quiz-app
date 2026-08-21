export interface QuestionScoreParams {
  isCorrect: boolean;
  isAnswered: boolean;
  timeTakenSeconds: number;
  allottedTimeSeconds: number;
  marks?: number;
  negativeMarks?: number;
  negativeMarkingEnabled?: boolean;
  timeBonusEnabled?: boolean;
}

export interface QuestionScoreResult {
  baseScore: number;
  speedBonus: number;
  totalScore: number;
}

/**
 * Calculates question score incorporating accuracy and speed-weighted bonus.
 * Speed bonus is ONLY applied when the question is answered correctly.
 */
export function calculateQuestionScore(params: QuestionScoreParams): QuestionScoreResult {
  const marks = params.marks ?? 4;
  const neg = params.negativeMarks ?? 1;
  const maxBonus = marks * 0.15; // 15% max bonus pool per question

  if (!params.isAnswered) {
    return { baseScore: 0, speedBonus: 0, totalScore: 0 };
  }

  if (!params.isCorrect) {
    const penalty = params.negativeMarkingEnabled ? -neg : 0;
    return { baseScore: penalty, speedBonus: 0, totalScore: penalty };
  }

  // Correct answer base marks
  const baseScore = marks;
  let speedBonus = 0;

  if (params.timeBonusEnabled !== false) {
    const allotted = Math.max(1, params.allottedTimeSeconds || 30);
    const timeTaken = Math.min(allotted, Math.max(0, params.timeTakenSeconds));
    const speedRatio = Math.max(0, (allotted - timeTaken) / allotted);
    speedBonus = Number((maxBonus * speedRatio).toFixed(2));
  }

  const totalScore = Number((baseScore + speedBonus).toFixed(2));
  return { baseScore, speedBonus, totalScore };
}

export interface CandidateEvaluationParams {
  totalQuestions: number;
  correctCount: number;
  answeredCount: number;
  totalScore: number;
  maxPossibleScore: number;
  totalTimeTakenSeconds: number;
}

export function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
