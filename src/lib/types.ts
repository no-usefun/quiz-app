export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOption: string;
  marks?: number;
  negativeMarks?: number;
  questionTimerSeconds?: number;
}

export interface QuizTest {
  testCode: string;
  quizName: string;
  description?: string;
  subject?: string;
  subjectCode?: string;
  targetClass: string;
  totalTimeLimitMinutes: number;
  passingMarks?: number;
  settings: {
    negativeMarking: boolean;
    automatedAiPenalty: boolean;
    publishScoresImmediately: boolean; // default: false
    revealSolutions: boolean;          // default: false
    showIntegrityFlagsToStudent: boolean; // default: false
    timeBonusEnabled?: boolean;
    allowReview?: boolean;
    allowResume?: boolean;
    autoSubmit?: boolean;
  };
  questions: QuizQuestion[];
  allowedRegistrationNumbers?: string[];
  createdAt: string;
  status: "LIVE" | "ENDED";
}

export interface StudentAnswer {
  questionId: number;
  selectedOption: string | null;
  timeTakenSeconds: number;
  isCorrect?: boolean;
  baseScore?: number;
  speedBonus?: number;
}

export interface StudentTestResult {
  testCode: string;
  quizName: string;
  targetClass: string;
  studentName: string;
  answers: StudentAnswer[];
  submittedAt: string;
  rawScore: number;       // Base percentage or points
  adjustedScore: number;  // Final score with speed bonus
  accuracyPercentage?: number;
  speedBonusTotal?: number;
  totalQuestions: number;
  correctCount: number;
  grade: string;
  timeTakenTotalSeconds: number;
  flags: {
    type: "tab_switch" | "fullscreen_exit" | "right_click" | "copy_attempt";
    label: string;
    count: number;
  }[];
}
