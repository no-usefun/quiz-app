"use client";
import { useProctoring } from "@/hooks/useProctoring";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Video,
} from "lucide-react";

// TODO: BACKEND INTEGRATION - Replace mockQuestions with a real API call.
// On page load: GET /api/assessments/{testCode}/questions  with Authorization: Bearer {token}
// Expected response: Array<{
//   id: number,
//   type: 'MCQ' | 'FITB',
//   text: string,
//   timeLimitSeconds: number,
//   options?: string[]   // only for MCQ
// }>
// Note: correctAnswer / correctOptionIndex must NOT be returned to the client.
const mockQuestions = [
  {
    id: 1,
    text: "Which data structure operates on a Last In, First Out (LIFO) principle?",
    options: ["Queue", "Stack", "Linked List", "Binary Tree"],
    timeLimit: 30,
  },
  {
    id: 2,
    text: "What is the time complexity of searching for an element in a balanced Binary Search Tree?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    timeLimit: 45,
  },
];

export default function TestArenaPage({
  params,
}: {
  params: { testCode: string };
}) {
  const { warnings, violationCount, requestFullscreen } = useProctoring();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(mockQuestions[0].timeLimit);
  const [isTestComplete, setIsTestComplete] = useState(false);

  const currentQuestion = mockQuestions[currentIndex];
  const progressPercentage = ((currentIndex + 1) / mockQuestions.length) * 100;
  const timePercentage = (timeLeft / currentQuestion.timeLimit) * 100;

  // Timer Countdown Logic
  useEffect(() => {
    if (isTestComplete) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleNextQuestion(true); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, isTestComplete]);

  const handleNextQuestion = (timeOut = false) => {
    // TODO: BACKEND INTEGRATION - Submit the student's answer for this question.
    // POST /api/assessments/{testCode}/answers  with Authorization: Bearer {token}
    // Request body: { questionId: number, selectedOption: string | null, timeTakenSeconds: number, timedOut: boolean }
    // Expected response: { acknowledged: true }  (grading happens server-side)
    // Also report current proctoring violations:
    // POST /api/assessments/{testCode}/flags  with body: { flags: warnings[] }
    console.log("Submitted:", selectedOption, "Time Left:", timeLeft);

    if (currentIndex < mockQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setTimeLeft(mockQuestions[currentIndex + 1].timeLimit);
    } else {
      // TODO: BACKEND INTEGRATION - All questions answered. Submit final proctoring report.
      // POST /api/assessments/{testCode}/submit  with Authorization: Bearer {token}
      // Body: { totalViolations: violationCount, flagSummary: warnings }
      // Expected response: { submitted: true, resultAvailableAt: ISO8601 }
      setIsTestComplete(true);
    }
  };

  if (isTestComplete) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3eefc] p-4 font-sans">
        <div className="w-full max-w-md rounded-[2.5rem] bg-white p-10 text-center shadow-2xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="mb-2 text-3xl font-extrabold text-slate-900">
            Assessment Complete!
          </h2>
          <p className="mb-8 text-slate-500">
            Your answers and time data have been securely submitted to the
            teacher's dashboard.
          </p>
          <button
            onClick={() => router.push("/dashboard/student")}
            className="w-full rounded-full bg-black px-6 py-4 font-bold text-white transition-transform hover:scale-105 active:scale-95"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      {/* LEFT COLUMN: Main Quiz UI */}
      <div className="flex flex-1 flex-col rounded-[2.5rem] bg-white shadow-2xl border border-white/50 relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-600">
              {params.testCode}
            </span>
            <span className="text-sm font-medium text-slate-400">
              Question {currentIndex + 1} of {mockQuestions.length}
            </span>
          </div>

          {/* Dynamic Timer */}
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-2 font-bold transition-colors ${
              timeLeft <= 10
                ? "bg-red-100 text-red-600 animate-pulse"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <Clock className="h-5 w-5" />
            00:{timeLeft.toString().padStart(2, "0")}
          </div>
        </header>

        {/* Progress Bar */}
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>

        {/* Question Area */}
        <div className="flex-1 overflow-y-auto px-8 py-10 md:px-16 md:py-12">
          <h2 className="mb-10 text-3xl font-extrabold leading-tight text-slate-900 md:text-4xl">
            {currentQuestion.text}
          </h2>

          <div className="space-y-4">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(option)}
                className={`w-full rounded-2xl border-2 p-6 text-left text-lg font-medium transition-all ${
                  selectedOption === option
                    ? "border-blue-600 bg-blue-50 text-blue-900 shadow-md"
                    : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                      selectedOption === option
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-100 bg-slate-50 px-8 py-6 flex justify-end">
          <button
            onClick={() => handleNextQuestion(false)}
            disabled={!selectedOption}
            className="flex items-center gap-2 rounded-full bg-black px-8 py-4 text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 shadow-lg shadow-black/10"
          >
            {currentIndex === mockQuestions.length - 1
              ? "Submit Assessment"
              : "Save & Next"}
            <ChevronRight className="h-5 w-5" />
          </button>
        </footer>
      </div>

      {/* RIGHT COLUMN: AI Proctoring Sidebar */}
      <aside className="hidden w-80 flex-col gap-6 pl-6 lg:flex">
        {/* Webcam Placeholder (We will inject TensorFlow here later) */}
        <div className="overflow-hidden rounded-3xl bg-slate-900 shadow-xl border border-slate-800">
          <div className="aspect-video w-full bg-slate-800 flex items-center justify-center relative">
            <Video className="h-8 w-8 text-slate-600" />
            <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>{" "}
              Live
            </div>
          </div>
          <div className="p-4">
            <h3 className="flex items-center gap-2 font-bold text-white text-sm">
              <ShieldAlert className="h-4 w-4 text-blue-500" /> AI Proctor
              Active
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Your webcam and browser activity are being monitored.
            </p>
          </div>
        </div>

        {/* System Warnings Panel */}
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h3 className="flex items-center gap-2 font-bold text-amber-900 mb-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> System Warnings
          </h3>
          <ul className="space-y-3 text-xs font-medium text-amber-800">
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></div>
              Do not exit fullscreen mode.
            </li>
            <li className="flex items-start gap-2">
              <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"></div>
              Ensure your face remains clearly visible in the frame.
            </li>
          </ul>
        </div>
      </aside>
    </main>
  );
}
