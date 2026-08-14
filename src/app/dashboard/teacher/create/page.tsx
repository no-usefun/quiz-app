"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  FileType,
  CheckCircle2,
  Lock,
  Clock,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  PlusCircle,
  HelpCircle,
} from "lucide-react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Core Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [subjectCode, setSubjectCode] = useState("CS-201");
  const [className, setClassName] = useState("CS-201 Section A");
  const [timeLimit, setTimeLimit] = useState(30); // in minutes
  const [passingMarks] = useState(40); // Removed from UI, kept in state as fallback

  // Collapsible accordion for advanced settings
  const [showAdvanced, setShowAdvanced] = useState(false);

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
    if (!title.trim()) return;

    const finalQuestions = parsedQuestions.length > 0 ? parsedQuestions : DEFAULT_SAMPLE_QUESTIONS;
    const generatedCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newTest: QuizTest = {
      testCode: generatedCode,
      quizName: title,
      description: description || "Midterm evaluation package",
      subject: subject || "Computer Science",
      subjectCode: subjectCode || "CS-201",
      targetClass: className || "General Batch",
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

  const handleAddDefaultQuestion = () => {
    const nextId = parsedQuestions.length > 0 ? parsedQuestions.length + 1 : DEFAULT_SAMPLE_QUESTIONS.length + 1;
    const newQ: QuizQuestion = {
      id: nextId,
      text: "New custom question text — click Edit to change",
      options: ["Option A", "Option B", "Option C", "Option D"],
      correctOption: "Option A",
    };
    if (parsedQuestions.length === 0) {
      setParsedQuestions([...DEFAULT_SAMPLE_QUESTIONS, newQ]);
    } else {
      setParsedQuestions([...parsedQuestions, newQ]);
    }
  };

  const handleDeleteQuestion = (id: number) => {
    const list = parsedQuestions.length > 0 ? parsedQuestions : DEFAULT_SAMPLE_QUESTIONS;
    const filtered = list.filter((q) => q.id !== id).map((q, idx) => ({ ...q, id: idx + 1 }));
    setParsedQuestions(filtered);
  };

  const questionsToPreview = parsedQuestions.length > 0 ? parsedQuestions : DEFAULT_SAMPLE_QUESTIONS;

  const inputClass =
    "w-full rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 selection:bg-[#e6e3e2] selection:text-[#165dfb] text-left">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Header Toolbar (Part 14) */}
        <header className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex h-8 w-8 items-center justify-center rounded-[8.8px] border border-[#d1dee8] bg-white text-[#78716b] hover:bg-[#e6e3e2]/40 hover:text-[#111111] transition-all cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
                ASSESSMENT BUILDER
              </span>
              <h1 className="text-xl font-extrabold text-[#111111] -tracking-wide mt-0.5">
                Create your assessment
              </h1>
              <p className="text-[11px] text-[#78716b] font-medium hidden sm:block">
                Build the secure assessment candidates will complete.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              type="button"
              className="rounded-[8.8px] border border-[#d1dee8] bg-white px-4 py-2 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2]/40 active:scale-[0.98] transition-all cursor-pointer"
            >
              Save Draft
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 disabled:opacity-40 cursor-pointer"
            >
              Publish Assessment
            </button>
          </div>
        </header>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Main Assessment Details workspace card (Part 15 & 16) */}
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] border-b border-[#d1dee8]/30 pb-2.5">
              Assessment Details
            </h3>

            <div className="space-y-4">
              <div className="text-left">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures &amp; Algorithms — Midterm"
                  className={inputClass}
                  required
                />
              </div>

              <div className="text-left">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Test your understanding of arrays, trees, graphs, and algorithmic complexity..."
                  className={inputClass}
                />
              </div>

              {/* Time Limit Visual Widget */}
              <div className="text-left">
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                  TIME LIMIT
                </label>
                <div className="inline-flex items-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-2">
                  <Clock className="h-4 w-4 text-[#78716b]" />
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-16 rounded-[8.8px] border border-[#d1dee8] bg-white py-1 px-2 text-xs text-[#111111] font-bold text-center outline-none focus:border-[#165dfb]"
                    min="1"
                    required
                  />
                  <span className="text-xs font-bold text-[#78716b] pr-2">minutes</span>
                </div>
              </div>
            </div>
          </div>

          {/* Question Builder Section (Part 17 & 18) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                QUESTIONS
              </h3>
              <span className="rounded-full bg-[#eef4ff] border border-[#d1dee8]/30 px-2 py-0.5 text-[10px] font-bold text-[#165dfb]">
                {questionsToPreview.length} questions
              </span>
            </div>

            {/* Questions workspace lists */}
            <div className="space-y-4">
              {questionsToPreview.map((q, idx) => (
                <div
                  key={q.id}
                  className="rounded-[8.8px] border border-[#d1dee8] bg-white p-5 space-y-4 hover:border-[#165dfb]/55 transition-colors relative"
                >
                  <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
                    <span className="font-mono text-xs font-bold text-[#78716b]">
                      Question 0{idx + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-[#165dfb] bg-[#eef4ff] border border-[#d1dee8]/30 px-2 py-0.5 rounded">
                        1 point
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="text-[#8c381c] hover:text-red-700 transition-colors cursor-pointer border-0 bg-transparent"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-extrabold text-[#111111] leading-relaxed">
                    {q.text}
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = opt === q.correctOption;
                      return (
                        <div
                          key={oi}
                          className={`flex items-center gap-2.5 rounded-[8.8px] border p-2.5 text-xs font-semibold ${
                            isCorrect
                              ? "border-[#165dfb] bg-[#eef4ff] text-[#165dfb]"
                              : "border-[#d1dee8] bg-white text-[#78716b]"
                          }`}
                        >
                          <span>{isCorrect ? "●" : "○"}</span>
                          <span className="truncate">
                            {String.fromCharCode(65 + oi)}: {opt}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* CSV File Upload Dropzone (Soft Mint backdrop - Part 20) */}
            <div className="rounded-[8.8px] border border-dashed border-[#d1dee8] bg-[#eef8f3] p-6 text-center hover:border-[#165dfb] transition-all">
              <input
                type="file"
                id="csv-upload-builder"
                className="hidden"
                accept=".csv"
                onChange={handleCsvUpload}
              />
              <label htmlFor="csv-upload-builder" className="cursor-pointer block">
                <FileType className="mx-auto mb-2 h-7 w-7 text-[#165dfb]" />
                <h4 className="text-xs font-extrabold text-[#111111] -tracking-wide">
                  Import Questions via CSV
                </h4>
                <p className="mt-0.5 text-[10px] text-[#78716b] font-medium leading-normal max-w-sm mx-auto">
                  {fileName
                    ? `Imported ${parsedQuestions.length} questions from file "${fileName}"`
                    : "Upload CSV template files containing QuestionText, OptionA, OptionB, OptionC, OptionD, CorrectAnswer."}
                </p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-[8.8px] border border-[#d1dee8] bg-white px-4 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2]/40 transition-all">
                  <Upload className="h-3.5 w-3.5 text-[#78716b]" /> Select CSV File
                </div>
              </label>
            </div>

            {/* Add Custom Question Button */}
            <button
              type="button"
              onClick={handleAddDefaultQuestion}
              className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] border border-dashed border-[#d1dee8] bg-white py-3 text-xs font-bold text-[#165dfb] hover:bg-[#eef4ff] transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" /> Add Custom Question Card
            </button>
          </div>

          {/* Advanced Settings Collapsible Accordion (Part 19 & 20) */}
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f1efff]/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 bg-[#f1efff] text-xs font-bold text-[#4c3d73] cursor-pointer border-0"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#4c3d73]" /> ADVANCED SETTINGS
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden border-t border-[#d1dee8]/30"
                >
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {/* Class target setting */}
                    <div className="text-left space-y-1">
                      <span className="text-[9px] font-bold text-[#78716b] uppercase">Target Class</span>
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full rounded-[8.8px] border border-[#d1dee8] bg-white p-2.5 text-xs text-[#111111]"
                      />
                    </div>
                    {/* Subject name setting */}
                    <div className="text-left space-y-1">
                      <span className="text-[9px] font-bold text-[#78716b] uppercase">Subject Name</span>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full rounded-[8.8px] border border-[#d1dee8] bg-white p-2.5 text-xs text-[#111111]"
                      />
                    </div>

                    {[
                      {
                        label: "Release Scores Instantly",
                        hint: "Students see scores immediately upon submission.",
                        val: publishScoresImmediately,
                        setter: setPublishScoresImmediately,
                      },
                      {
                        label: "Allow Students to View Solutions",
                        hint: "Expose step-by-step correction keys to student view.",
                        val: revealSolutions,
                        setter: setRevealSolutions,
                      },
                      {
                        label: "Show AI Integrity Flags",
                        hint: "Expose suspicion warning count to candidate scorecard.",
                        val: showIntegrityFlagsToStudent,
                        setter: setShowIntegrityFlagsToStudent,
                      },
                      {
                        label: "Enable Negative Marking",
                        hint: "Deduct 0.5 points for incorrect selections.",
                        val: negativeMarking,
                        setter: setNegativeMarking,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start justify-between gap-3 rounded-[8.8px] border border-[#d1dee8]/45 bg-white p-3"
                      >
                        <div className="text-left">
                          <span className="block text-xs font-bold text-[#111111]">
                            {item.label}
                          </span>
                          <span className="block text-[9px] text-[#78716b] leading-normal font-medium mt-0.5">
                            {item.hint}
                          </span>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={item.val}
                          onClick={() => item.setter(!item.val)}
                          className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-155 focus:outline-none ${
                            item.val ? "bg-[#165dfb]" : "bg-[#d1dee8]"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-155 ${
                              item.val ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Publish block at bottom (Part 22) */}
          <div className="pt-6 border-t border-[#d1dee8]/50 text-center space-y-4">
            <h3 className="text-xs font-extrabold text-[#78716b] uppercase tracking-wider">
              Ready to publish?
            </h3>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-[8.8px] border border-[#d1dee8] bg-white px-5 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2]/40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="rounded-[8.8px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 disabled:opacity-40 cursor-pointer"
              >
                Publish Assessment
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
