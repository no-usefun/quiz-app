export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOption: string;
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
  };
  questions: QuizQuestion[];
  createdAt: string;
  status: "LIVE" | "ENDED";
}

export interface StudentAnswer {
  questionId: number;
  selectedOption: string | null;
  timeTakenSeconds: number;
}

export interface StudentTestResult {
  testCode: string;
  quizName: string;
  targetClass: string;
  studentName: string;
  answers: StudentAnswer[];
  submittedAt: string;
  rawScore: number;       // Percentage (0-100)
  adjustedScore: number;  // Percentage after proctoring deductions (0-100)
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
