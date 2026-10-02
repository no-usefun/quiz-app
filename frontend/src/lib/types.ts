/**

* Shared frontend types aligned with the current Spring Boot API contract.
*
* Backend is the source of truth for quiz state, questions, attempts,
* scoring, and published results.
  */

export type UserRole = "STUDENT" | "TEACHER";

export type QuizStatus = "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";

export type ExamState = "WAITING" | "RUNNING" | "PAUSED" | "ENDED";

export type ResultVisibility =
  | "NONE"
  | "LEADERBOARD"
  | "QUESTION_WISE"
  | "BOTH";

export type QuestionType = "MCQ" | "MSQ" | "TRUE_FALSE";

export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";

export type AnswerStatus = "UNANSWERED" | "ANSWERED" | "CORRECT" | "INCORRECT";

export type QuizAvailabilityStatus =
  | "NOT_FOUND"
  | "NOT_PUBLISHED"
  | "NOT_STARTED"
  | "LIVE"
  | "ENDED";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

/* -------------------------------------------------------------------------- */
/* Authentication                                                             */
/* -------------------------------------------------------------------------- */

export interface UserSummary {
  id: number;
  firstName: string;
  lastName?: string | null;
  fullName: string;
  email: string;
  role: string;
  college?: string | null;
  department?: string | null;
  registrationNo?: string | null;
  phone?: string | null;
  authProvider?: string | null;
  profileImage?: string | null;
  verified: boolean;
  active: boolean;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: UserSummary;
}

export interface SignupResponse {
  message: string;
  verificationRequired: boolean;
  user: UserSummary;
}

/* -------------------------------------------------------------------------- */
/* Quiz package / student exam                                               */
/* -------------------------------------------------------------------------- */

export interface OptionResponse {
  optionId: number;
  optionText?: string | null;
  optionImage?: string | null;
  optionOrder: number;
}

export interface QuestionResponse {
  questionId: number;
  questionText: string;
  imageUrl?: string | null;
  questionType: QuestionType;
  marks: number;
  negativeMarks?: number | null;
  questionTimerSeconds?: number | null;
  difficulty?: Difficulty | null;
  displayOrder: number;
  options: OptionResponse[];
}

export interface QuizPackageResponse {
  quizId: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  subject?: string | null;
  subjectCode?: string | null;
  totalStudents: number;
  totalQuestions: number;
  totalMarks: number;
  overallTimerSeconds: number;
  negativeMarking: boolean;
  negativeMarks?: number | null;
  randomQuestionOrder: boolean;
  randomOptionOrder: boolean;
  allowReview: boolean;
  allowResume: boolean;
  autoSubmit: boolean;
  startTime?: string | null;
  endTime?: string | null;
  questions: QuestionResponse[];
}

/* -------------------------------------------------------------------------- */
/* Teacher quiz responses                                                     */
/* -------------------------------------------------------------------------- */

export interface QuizResponse {
  quizId: number;
  quizCode: string;
  teacherId: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  subject?: string | null;
  subjectCode?: string | null;
  totalStudents: number;
  totalQuestions: number;
  totalMarks: number;
  overallTimerSeconds: number;
  negativeMarking: boolean;
  negativeMarks?: number | null;
  timeBonusEnabled: boolean;
  randomQuestionOrder: boolean;
  randomOptionOrder: boolean;
  allowReview: boolean;
  allowResume: boolean;
  autoSubmit: boolean;
  startTime?: string | null;
  endTime?: string | null;
  resultVisibility: ResultVisibility;
  resultsPublished: boolean;
  acceptedEmailDomain?: string | null;
  allowedRegistrationNumbers?: string[];
  status: QuizStatus;
  examState: ExamState;
}

export interface TeacherOptionDetail {
  optionId: number;
  optionText?: string | null;
  optionImage?: string | null;
  correct: boolean;
  optionOrder: number;
}

export interface TeacherQuestionDetail {
  questionId: number;
  questionText: string;
  imageUrl?: string | null;
  explanation?: string | null;
  questionType: QuestionType;
  marks: number;
  negativeMarks?: number | null;
  questionTimerSeconds?: number | null;
  difficulty?: Difficulty | null;
  displayOrder: number;
  options: TeacherOptionDetail[];
}

export interface TeacherQuizDetailResponse extends QuizResponse {
  maxTabSwitch?: number | null;
  questions: TeacherQuestionDetail[];
}

/* -------------------------------------------------------------------------- */
/* Attempts                                                                   */
/* -------------------------------------------------------------------------- */

export interface AttemptResponse {
  attemptId: number;
  quizId: number;
  studentId: number;
  startedAt: string;
  submittedAt?: string | null;
  status: AttemptStatus;
  currentQuestion?: number | null;
  totalTimeTaken?: number | null;
}

export interface SubmitAnswerRequest {
  questionId: number;
  selectedOptionIds: number[];
  responseTimeSeconds: number;
}

export interface SubmitAttemptRequest {
  answers: SubmitAnswerRequest[];
}

export interface SubmitAttemptResponse {
  attemptId: number;
  quizId: number;
  status: AttemptStatus;
  finalScore: number;
  totalMarks: number;
  totalTimeTaken: number;
  submittedAt: string;
}

export interface StudentSubmissionResponse {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  status: AttemptStatus;
  finalScore?: number | null;
  totalMarks?: number | null;
  percentage?: number | null;
  totalTimeTaken?: number | null;
  startedAt: string;
  submittedAt?: string | null;
  resultsAvailable: boolean;
}

export interface AttemptResultResponse {
  attemptId: number;
  quizId: number;
  quizTitle: string;
  studentId: number;
  status: AttemptStatus;
  finalScore: number;
  totalMarks: number;
  percentage: number;
  totalTimeTaken: number;
  startedAt: string;
  submittedAt: string;
}

export interface AttemptResultDetailResponse {
  questionId: number;
  questionText: string;
  displayOrder: number;
  selectedOptionIds: number[];
  correctOptionIds: number[];
  answerStatus: AnswerStatus;
  correct: boolean;
  marksAwarded: number;
  questionMarks: number;
  responseTimeSeconds?: number | null;
}

export interface LeaderboardEntryResponse {
  rank: number;
  studentId: number;
  studentName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  totalTimeTaken: number;
}

/* -------------------------------------------------------------------------- */
/* Availability                                                               */
/* -------------------------------------------------------------------------- */

export interface QuizAvailabilityResponse {
  quizCode: string;
  available: boolean;
  status: QuizAvailabilityStatus;
  startTime?: string | null;
  endTime?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Legacy compatibility types                                                 */
/* -------------------------------------------------------------------------- */

/**

* @deprecated Use QuestionResponse.
*
* Kept temporarily so older UI code can compile while it is migrated
* to the backend DTO shape.
  */
export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctOption?: string;
  marks?: number;
  negativeMarks?: number;
  questionTimerSeconds?: number;
}

/**

* @deprecated Use QuizResponse / QuizPackageResponse.
  */
export interface QuizTest {
  testCode: string;
  quizName: string;
  description?: string;
  subject?: string;
  subjectCode?: string;
  targetClass?: string;
  totalTimeLimitMinutes: number;
  settings?: {
    negativeMarking: boolean;
    timeBonusEnabled?: boolean;
    allowReview?: boolean;
    allowResume?: boolean;
    autoSubmit?: boolean;
  };
  questions: QuizQuestion[];
  allowedRegistrationNumbers?: string[];
  createdAt?: string;
  status: "LIVE" | "ENDED";
}

/**

* @deprecated Backend scoring is authoritative.
  */
export interface StudentAnswer {
  questionId: number;
  selectedOptionIds?: number[];
  selectedOption?: string | null;
  responseTimeSeconds?: number;
  timeTakenSeconds?: number;
  isCorrect?: boolean;
  score?: number;
}

/**

* @deprecated Use AttemptResultResponse and
* AttemptResultDetailResponse.
  */
export interface StudentTestResult {
  testCode?: string;
  quizName?: string;
  studentName?: string;
  answers: StudentAnswer[];
  submittedAt: string;
  score: number;
  accuracyPercentage?: number;
  totalQuestions?: number;
  correctCount?: number;
  timeTakenTotalSeconds?: number;
}
