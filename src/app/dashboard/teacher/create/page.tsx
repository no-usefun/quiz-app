"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Upload, FileType, CheckCircle2, Lock } from "lucide-react";
import { QuizQuestion, QuizTest } from "@/lib/types";
import { saveTest } from "@/lib/storage";

const DEFAULT_SAMPLE_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    text: "Which data structure operates on a Last In, First Out (LIFO) principle?",
    options: ["Queue", "Stack", "Linked List", "Binary Tree"],
    correctOption: "Stack",
  },
  {
    id: 2,
    text: "What is the worst-case time complexity of searching in a balanced Binary Search Tree?",
    options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    correctOption: "O(log n)",
  },
  {
    id: 3,
    text: "Which property in SQL guarantees that a database transaction is completely committed or aborted?",
    options: ["Atomicity", "Consistency", "Isolation", "Durability"],
    correctOption: "Atomicity",
  },
];

export default function CreateAssessmentPage() {
  const router = useRouter();

  // Core Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [className, setClassName] = useState("");
  const [timeLimit, setTimeLimit] = useState(30); // in minutes
  const [passingMarks, setPassingMarks] = useState(40);

  // Settings & Permission Toggles
  const [negativeMarking, setNegativeMarking] = useState(true);
  const aiPenalty = true;
  const [publishScoresImmediately, setPublishScoresImmediately] = useState(false);
  const [revealSolutions, setRevealSolutions] = useState(false);
  const [showIntegrityFlagsToStudent, setShowIntegrityFlagsToStudent] = useState(false);

  // File state
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((line) => line.trim() !== "");

      // Format: QuestionText, OptionA, OptionB, OptionC, OptionD, CorrectAnswer
      const jsonQuestions: QuizQuestion[] = lines.map((line, index) => {
        const parts = line.split(",").map((s) => s?.trim());
        const [qText, optA, optB, optC, optD, correct] = parts;
        return {
          id: index + 1,
          text: qText || `Question ${index + 1}`,
          options: [optA || "Option A", optB || "Option B", optC || "Option C", optD || "Option D"],
          correctOption: correct || optA || "Option A",
        };
      });
      setParsedQuestions(jsonQuestions);
    };
    reader.readAsText(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !className.trim()) return;

    const finalQuestions = parsedQuestions.length > 0 ? parsedQuestions : DEFAULT_SAMPLE_QUESTIONS;
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newTest: QuizTest = {
      testCode: generatedCode,
      quizName: title,
      description: description || "Midterm evaluation package",
      subject: subject || "Computer Science",
      subjectCode: subjectCode || "CS-201",
      targetClass: className,
      totalTimeLimitMinutes: timeLimit,
      passingMarks: passingMarks,
      settings: {
        negativeMarking: negativeMarking,
        automatedAiPenalty: aiPenalty,
        publishScoresImmediately: publishScoresImmediately,
        revealSolutions: revealSolutions,
        showIntegrityFlagsToStudent: showIntegrityFlagsToStudent,
      },
      questions: finalQuestions,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      status: "LIVE",
    };

    saveTest(newTest);
    router.push(`/dashboard/teacher/share/${generatedCode}`);
  };

  const questionsToPreview = parsedQuestions.length > 0 ? parsedQuestions : DEFAULT_SAMPLE_QUESTIONS;

  const inputClass = "w-full rounded-lg border border-slate-205 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white font-medium";

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-850 p-4 md:p-6 lg:p-8 selection:bg-blue-100">
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="mx-auto max-w-4xl rounded-2xl bg-white p-5 md:p-7 border border-slate-200 shadow-xs"
      >
        <header className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Assessment Builder
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">Create Assessment</h1>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !className.trim()}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 disabled:opacity-40 transition-all shadow-xs"
          >
            Publish &amp; Share
          </button>
        </header>

        <form className="space-y-6" onSubmit={handleSave}>
          {/* Core Metadata Fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Quiz Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Data Structures &amp; Algorithms Midterm"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Target Class / Batch
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. CS-201 Section A"
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Subject Name
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Science"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Subject Code
              </label>
              <input
                type="text"
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value)}
                placeholder="e.g. CS-201"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Total Time Limit (Minutes)
              </label>
              <input
                type="number"
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className={inputClass}
                min="1"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Passing Marks (%)
              </label>
              <input
                type="number"
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className={inputClass}
                min="0"
                max="100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-550">
                Description / Instructions
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description and candidate instructions..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Result Release & Permission Controls */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-500" /> Result Release &amp; Student Privacy Flags
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {[
                {
                  label: "Release Scores Instantly",
                  hint: "If OFF, students see \"Submitted - Pending Evaluation\" until published.",
                  checked: publishScoresImmediately,
                  onChange: setPublishScoresImmediately,
                },
                {
                  label: "Allow Students to View Solutions",
                  hint: "If OFF, question breakdown and answer keys remain hidden.",
                  checked: revealSolutions,
                  onChange: setRevealSolutions,
                },
                {
                  label: "Show AI Integrity Flags to Student",
                  hint: "If OFF, suspicion logs are strictly visible to teacher only.",
                  checked: showIntegrityFlagsToStudent,
                  onChange: setShowIntegrityFlagsToStudent,
                },
                {
                  label: "Enable Negative Marking (0.5 Marks)",
                  hint: "Deduct marks for incorrect student answers.",
                  checked: negativeMarking,
                  onChange: setNegativeMarking,
                },
              ].map((toggle) => (
                <label
                  key={toggle.label}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-205 bg-white p-3 cursor-pointer hover:border-slate-300 transition-colors"
                >
                  <div>
                    <span className="block text-xs font-bold text-slate-900">{toggle.label}</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">{toggle.hint}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={toggle.checked}
                    onChange={(e) => toggle.onChange(e.target.checked)}
                    className="h-3.5 w-3.5 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* CSV File Upload Dropzone */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-blue-500">
            <input
              type="file"
              id="csv-upload"
              className="hidden"
              accept=".csv"
              onChange={handleCsvUpload}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <FileType className="mx-auto mb-2.5 h-6.5 w-6.5 text-slate-400" />
              <h3 className="text-xs font-bold text-slate-900">
                Upload Questions via CSV
              </h3>
              <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                {fileName
                  ? `Loaded ${parsedQuestions.length} questions from "${fileName}"`
                  : "Format: QuestionText, OptionA, OptionB, OptionC, OptionD, CorrectAnswer"}
              </p>
              <div className="mt-3.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs">
                <Upload className="h-3.5 w-3.5 text-slate-400" /> Browse CSV File
              </div>
            </label>
          </div>

          {/* UI Table Preview of Questions */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-605" />
                Question Table Preview ({questionsToPreview.length} Questions)
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {parsedQuestions.length > 0 ? "Uploaded from CSV" : "Default Sample Questions"}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5">Question Text</th>
                      <th className="p-2.5">Options</th>
                      <th className="p-2.5 w-36 text-center">Correct Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {questionsToPreview.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 text-center font-bold text-slate-300">{q.id}</td>
                        <td className="p-2.5 font-bold text-slate-800 leading-snug">{q.text}</td>
                        <td className="p-2.5">
                          <div className="flex flex-wrap gap-1">
                            {q.options.map((opt, oi) => (
                              <span
                                key={oi}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                                  opt === q.correctOption
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100 font-bold"
                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                }`}
                              >
                                {String.fromCharCode(65 + oi)}: {opt}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 text-[10px] font-bold">
                            {q.correctOption}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </form>
      </motion.main>
    </div>
  );
}
