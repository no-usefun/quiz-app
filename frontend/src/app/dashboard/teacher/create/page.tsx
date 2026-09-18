"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import {
  ArrowLeft,
  Upload,
  FileType,
  Clock,
  ChevronDown,
  Trash2,
  PlusCircle,
  Lock,
  Check,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export default function CreateAssessmentPage() {
  const router = useRouter();
  const { user } = useSession();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "Read all questions carefully before submitting.",
  );
  const [subject, setSubject] = useState("Computer Science");
  const [subjectCode, setSubjectCode] = useState("CS-201");
  const [allowedRollsText, setAllowedRollsText] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [publishScoresImmediately, setPublishScoresImmediately] =
    useState(false);
  const [revealSolutions, setRevealSolutions] = useState(false);

  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text || !text.trim()) {
        setValidationError("The uploaded file is empty.");
        setParsedQuestions([]);
        return;
      }

      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          const rawList = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.questions)
              ? parsed.questions
              : null;

          if (!rawList || rawList.length === 0) {
            setValidationError(
              "JSON file must contain a non-empty array of questions.",
            );
            return setParsedQuestions([]);
          }

          const validated: any[] = [];
          for (let idx = 0; idx < rawList.length; idx++) {
            const q = rawList[idx];
            const qNum = idx + 1;
            const qText = (q.questionText || q.text || "").trim();
            if (!qText)
              return (
                setValidationError(`Question ${qNum}: text is required.`),
                setParsedQuestions([])
              );

            let normalizedOpts: any[] = [];
            if (typeof q.options[0] === "string") {
              const strOpts: string[] = q.options.map((o: any) =>
                String(o).trim(),
              );
              const correctStr = (
                q.correctOption ||
                q.correctAnswer ||
                q.answer ||
                ""
              ).trim();
              if (!correctStr)
                return (
                  setValidationError(
                    `Question ${qNum}: correct option required.`,
                  ),
                  setParsedQuestions([])
                );

              const matchedIndex = strOpts.findIndex(
                (o) =>
                  o.toLowerCase() === correctStr.toLowerCase() ||
                  (correctStr.length === 1 &&
                    String.fromCharCode(65 + strOpts.indexOf(o)) ===
                      correctStr.toUpperCase()),
              );

              normalizedOpts = strOpts.map((optText, oIdx) => ({
                optionText: optText,
                optionImage: "",
                optionOrder: oIdx + 1,
                isCorrect:
                  oIdx ===
                  (matchedIndex !== -1
                    ? matchedIndex
                    : strOpts.indexOf(correctStr)),
              }));
            } else {
              normalizedOpts = q.options.map((opt: any, oIdx: number) => ({
                optionText: (opt.optionText || opt.text).trim(),
                optionImage: "",
                optionOrder: opt.optionOrder || oIdx + 1,
                isCorrect: !!opt.isCorrect,
              }));
            }

            validated.push({
              questionText: qText,
              imageUrl: "",
              explanation: q.explanation || "",
              questionType: q.questionType || "MCQ",
              marks: Number(q.marks) || 1,
              negativeMarks:
                q.negativeMarks !== undefined
                  ? Number(q.negativeMarks)
                  : negativeMarking
                    ? 0.25
                    : 0,
              questionTimerSeconds: q.questionTimerSeconds || 60,
              difficulty: q.difficulty || "MEDIUM",
              displayOrder: qNum,
              options: normalizedOpts,
            });
          }
          setParsedQuestions(validated);
        } catch (err: any) {
          setValidationError(`Failed to parse JSON file.`);
          setParsedQuestions([]);
        }
      } else {
        Papa.parse(text, {
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as string[][];
            if (rows.length === 0) {
              setValidationError("CSV file is empty.");
              return setParsedQuestions([]);
            }

            const firstLineLower = rows[0].join(" ").toLowerCase();
            const hasHeader =
              firstLineLower.includes("question") ||
              firstLineLower.includes("option");
            const contentRows = hasHeader ? rows.slice(1) : rows;

            const validatedQuestions: any[] = [];
            for (let index = 0; index < contentRows.length; index++) {
              const parts = contentRows[index].map((s) => s.trim());
              if (parts.length < 3) continue;

              const qText = parts[0];
              const optA = parts[1] || "";
              const optB = parts[2] || "";
              const optC = parts[3] || "";
              const optD = parts[4] || "";
              const correctIdentifier = (
                parts[5] ||
                parts[parts.length - 1] ||
                ""
              ).trim();

              const availableOptions = [
                { text: optA, letter: "A" },
                { text: optB, letter: "B" },
                ...(optC ? [{ text: optC, letter: "C" }] : []),
                ...(optD ? [{ text: optD, letter: "D" }] : []),
              ];

              const matchedOptIndex = availableOptions.findIndex(
                (o) =>
                  o.letter.toUpperCase() === correctIdentifier.toUpperCase() ||
                  o.text.toLowerCase() === correctIdentifier.toLowerCase(),
              );

              validatedQuestions.push({
                questionText: qText,
                imageUrl: "",
                explanation: "",
                questionType: "MCQ",
                marks: parts[6] ? Number(parts[6]) : 1,
                negativeMarks: negativeMarking ? 0.25 : 0,
                questionTimerSeconds: 60,
                difficulty: "MEDIUM",
                displayOrder: index + 1,
                options: availableOptions.map((opt, oIdx) => ({
                  optionText: opt.text,
                  optionImage: "",
                  optionOrder: oIdx + 1,
                  isCorrect:
                    oIdx === (matchedOptIndex === -1 ? 0 : matchedOptIndex),
                })),
              });
            }
            setParsedQuestions(validatedQuestions);
          },
        });
      }
    };
    reader.readAsText(file);
  };

  const handleAddNewQuestion = () => {
    setValidationError(null);
    setParsedQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        imageUrl: "",
        explanation: "",
        questionType: "MCQ",
        marks: 1,
        negativeMarks: negativeMarking ? 0.25 : 0,
        questionTimerSeconds: 60,
        difficulty: "MEDIUM",
        displayOrder: prev.length + 1,
        options: [
          { optionText: "", optionImage: "", optionOrder: 1, isCorrect: true },
          { optionText: "", optionImage: "", optionOrder: 2, isCorrect: false },
          { optionText: "", optionImage: "", optionOrder: 3, isCorrect: false },
          { optionText: "", optionImage: "", optionOrder: 4, isCorrect: false },
        ],
      },
    ]);
  };

  const handleUpdateQuestionField = (
    idx: number,
    field: string,
    value: any,
  ) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const handleUpdateOption = (
    qIdx: number,
    optIdx: number,
    textValue: string,
  ) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = { ...newOpts[optIdx], optionText: textValue };
        return { ...q, options: newOpts };
      }),
    );
  };

  const handleSetCorrectOption = (qIdx: number, optIdx: number) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = q.options.map((opt: any, oi: number) => ({
          ...opt,
          isCorrect: oi === optIdx,
        }));
        return { ...q, options: newOpts };
      }),
    );
  };

  const handleDeleteQuestion = (idx: number) => {
    setParsedQuestions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, displayOrder: i + 1 })),
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim())
      return setValidationError("Please enter an assessment title.");
    if (parsedQuestions.length === 0)
      return setValidationError(
        "Please add at least one question before publishing.",
      );

    for (let i = 0; i < parsedQuestions.length; i++) {
      if (!parsedQuestions[i].questionText.trim()) {
        return setValidationError(`Question ${i + 1} cannot have empty text.`);
      }
      for (let j = 0; j < parsedQuestions[i].options.length; j++) {
        if (!parsedQuestions[i].options[j].optionText.trim()) {
          return setValidationError(
            `Option ${String.fromCharCode(65 + j)} in Question ${i + 1} cannot be empty.`,
          );
        }
      }
    }

    setSubmitting(true);
    setValidationError(null);

    const token = localStorage.getItem("dynoquizz_token");
    let tokenUserId = 0;
    if (token) {
      try {
        const payloadBase64 = token.split(".")[1];
        const decoded = JSON.parse(atob(payloadBase64));
        tokenUserId = decoded.id || decoded.userId || decoded.sub || 0;
      } catch (e) {
        // ignore
      }
    }

    const safeTeacherId = user?.id ? Number(user.id) : Number(tokenUserId);

    // --- FIX 1: Timestamp & Availability window ---
    const now = new Date();
    // Shift start time back by 5 minutes to bypass slight server clock mismatches
    const startTime = new Date(now.getTime() - 5 * 60000);
    // Give a 24-hour window for the quiz to remain "Available" in the lobby
    // (The test duration itself is still strictly enforced by overallTimerSeconds)
    const endTime = new Date(now.getTime() + 24 * 60 * 60000);

    const resultVis =
      publishScoresImmediately && revealSolutions
        ? "BOTH"
        : publishScoresImmediately
          ? "LEADERBOARD"
          : revealSolutions
            ? "QUESTION_WISE"
            : "NONE";

    // Process authorized rolls
    const allowedRollsArray = allowedRollsText
      .split(",")
      .map((roll) => roll.trim())
      .filter((roll) => roll.length > 0);

    try {
      const payload = {
        teacherId: Number(safeTeacherId > 0 ? safeTeacherId : 1),
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        subject: subject.trim(),
        subjectCode: subjectCode.trim(),
        overallTimerSeconds: Math.floor(timeLimit * 60),
        negativeMarking: Boolean(negativeMarking),
        negativeMarks: Number(negativeMarking ? negativeMarks : 0),
        timeBonusEnabled: false,
        randomQuestionOrder: true,
        randomOptionOrder: true,
        allowReview: true,
        allowResume: true,
        autoSubmit: true,

        // Use our adjusted timestamps
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),

        resultVisibility: resultVis,
        status: "PUBLISHED",

        allowedRolls: allowedRollsArray,
        totalStudents: allowedRollsArray.length,

        questions: parsedQuestions.map((q: any, index: number) => ({
          questionText: String(q.questionText).trim(),
          imageUrl: "",
          explanation: String(q.explanation || "").trim(),
          questionType: "MCQ",
          marks: Number(q.marks || 1),
          negativeMarks: Number(negativeMarking ? negativeMarks : 0),
          questionTimerSeconds: Number(q.questionTimerSeconds || 60),
          difficulty: q.difficulty || "MEDIUM",
          displayOrder: Number(index + 1),
          options: q.options.map((opt: any, optIndex: number) => ({
            optionText: String(opt.optionText).trim(),
            optionImage: "",
            optionOrder: Number(optIndex + 1),
            isCorrect: Boolean(opt.isCorrect),
          })),
        })),
      };

      const res = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            errorData.error ||
            `Server returned status: ${res.status}`,
        );
      }

      const data = await res.json();

      // ── Write to the canonical roster key ────────────────────────────────
      // The dashboard reads dynoquizz_teacher_quizzes directly from localStorage.
      // Spread order:
      //   1. Raw backend response first  → preserves quizId, quizCode, and any
      //      other server-assigned fields.
      //   2. Local payload fields on top → ensures title, subject, counts are
      //      always populated even when the backend omits them.
      //   3. status pinned to "PUBLISHED" last → a successful 2xx POST always
      //      means the quiz is published, regardless of what the server echoes.
      const newQuiz = {
        ...data,
        title: payload.title,
        description: payload.description,
        subject: payload.subject,
        subjectCode: payload.subjectCode,
        totalStudents: payload.totalStudents,
        totalQuestions: payload.questions.length,
        overallTimerSeconds: payload.overallTimerSeconds,
        status: "PUBLISHED",
      };

      try {
        const existing: any[] = JSON.parse(
          localStorage.getItem("dynoquizz_teacher_quizzes") || "[]",
        );
        // Deduplicate: remove any stale entry with the same quizId before prepending
        const deduped = existing.filter(
          (q) => (q.quizId ?? q.id) !== (newQuiz.quizId ?? newQuiz.id),
        );
        deduped.unshift(newQuiz); // newest first
        localStorage.setItem("dynoquizz_teacher_quizzes", JSON.stringify(deduped));
      } catch {
        // If localStorage write fails, proceed — redirect still works
      }

      // Navigate strictly to /dashboard/teacher/share/${data.quizId} using the database identifier
      router.push(`/dashboard/teacher/share/${data.quizId}`);
    } catch (err: any) {
      console.error("Failed to create quiz:", err);
      setValidationError(`Failed to create assessment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-[10px] border border-[#d1dee8] bg-[#fbfbfa] px-3.5 py-2.5 text-xs text-[#111111] outline-none transition-all placeholder:text-[#a8a29d] hover:border-[#b9cbd9] focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10 font-medium";

  const labelClass =
    "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 text-left">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-[#d1dee8]/60 bg-[#f5f5f4]/85 px-4 py-4 backdrop-blur-md md:-mx-6 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#d1dee8] bg-white text-[#78716b] shadow-sm transition-all hover:border-[#b9cbd9] hover:bg-white hover:text-[#111111]"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
                ASSESSMENT BUILDER
              </span>
              <h1 className="text-xl font-extrabold text-[#111111] -tracking-wide mt-0.5">
                Create your assessment
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#d1dee8] bg-white px-3 py-1 text-[10px] font-bold text-[#78716b] sm:inline-flex">
              {parsedQuestions.length}{" "}
              {parsedQuestions.length === 1 ? "question" : "questions"}
            </span>
            <button
              onClick={(e) => handleSave(e)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {submitting ? "Publishing..." : "Publish Assessment"}
            </button>
          </div>
        </header>

        {validationError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[10px] border border-[#8c381c]/25 bg-[#fbeee8] p-3.5 text-xs font-semibold text-[#8c381c]"
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span className="leading-relaxed">{validationError}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSave(e)} className="space-y-6">
          <div className="rounded-[14px] border border-[#d1dee8] bg-white p-6 space-y-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="flex items-center gap-2 border-b border-[#d1dee8]/50 pb-3 text-xs font-bold uppercase tracking-wider text-[#111111]">
              <span className="h-3.5 w-1 rounded-full bg-[#165dfb]" />
              Assessment Details
            </h3>
            <div className="space-y-4">
              <div className="text-left">
                <label className={labelClass}>Assessment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms — Midterm"
                  className={`${inputClass} text-sm`}
                  required
                />
              </div>
              <div className="text-left">
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this assessment covers"
                  className={`${inputClass} resize-y leading-relaxed`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-left">
                  <label className={labelClass}>Subject Name</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className={labelClass}>Subject Code</label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className={labelClass}>Time Limit (minutes)</label>
                  <div className="flex items-center gap-2 rounded-[10px] border border-[#d1dee8] bg-[#fbfbfa] px-3 py-2.5 transition-all hover:border-[#b9cbd9] focus-within:border-[#165dfb] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#165dfb]/10">
                    <Clock className="h-4 w-4 shrink-0 text-[#78716b]" />
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      min="1"
                      className="bg-transparent outline-none w-full text-xs font-bold text-[#111111]"
                      required
                    />
                    <span className="text-[10px] font-bold uppercase text-[#a8a29d]">
                      min
                    </span>
                  </div>
                </div>
                <div className="text-left sm:col-span-3">
                  <label className={labelClass}>
                    Authorized Student Roll Numbers (Optional)
                  </label>
                  <textarea
                    value={allowedRollsText}
                    onChange={(e) => setAllowedRollsText(e.target.value)}
                    rows={2}
                    placeholder="Comma separated, e.g. 21BCE1001, 21BCE1002"
                    className={`${inputClass} resize-y leading-relaxed`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-2.5">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#111111]">
                <span className="h-3.5 w-1 rounded-full bg-[#165dfb]" />
                Questions
                <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-bold text-[#165dfb]">
                  {parsedQuestions.length}
                </span>
              </h3>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#d1dee8] bg-white px-6 py-10 text-center">
                <FileQuestion className="mx-auto mb-3 h-8 w-8 text-[#c9c5c2]" />
                <p className="text-xs font-bold text-[#57534e]">
                  No questions yet
                </p>
                <p className="mt-1 text-xs text-[#a8a29d]">
                  Import a CSV or JSON file, or add a question card below.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-[14px] border border-[#d1dee8] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:border-[#b9cbd9] hover:shadow-[0_6px_20px_-12px_rgba(16,24,40,0.28)]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#d1dee8]/50 bg-[#fbfbfa] px-5 py-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-[#57534e]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#eef4ff] font-mono text-[10px] font-bold text-[#165dfb]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        Question
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                          Marks
                        </label>
                        <input
                          type="number"
                          value={q.marks}
                          onChange={(e) =>
                            handleUpdateQuestionField(
                              idx,
                              "marks",
                              Number(e.target.value),
                            )
                          }
                          className="w-14 rounded-md border border-[#d1dee8] bg-white px-2 py-1 text-center text-xs font-bold text-[#111111] outline-none transition-all focus:border-[#165dfb] focus:ring-4 focus:ring-[#165dfb]/10"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          aria-label={`Delete question ${idx + 1}`}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[#a8a29d] transition-all hover:bg-[#fbeee8] hover:text-[#8c381c]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) =>
                          handleUpdateQuestionField(
                            idx,
                            "questionText",
                            e.target.value,
                          )
                        }
                        placeholder="Type your question"
                        className="w-full rounded-[10px] border border-[#d1dee8] bg-[#fbfbfa] px-3.5 py-2.5 text-sm font-semibold text-[#111111] outline-none transition-all placeholder:font-medium placeholder:text-[#a8a29d] hover:border-[#b9cbd9] focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10"
                      />

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {q.options.map((opt: any, oi: number) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-xs transition-all ${
                              opt.isCorrect
                                ? "border-[#165dfb] bg-[#eef4ff] shadow-[0_0_0_3px_rgba(22,93,251,0.08)]"
                                : "border-[#d1dee8] bg-white hover:border-[#b9cbd9] hover:bg-[#fbfbfa]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(idx, oi)}
                              aria-label={`Mark option ${String.fromCharCode(65 + oi)} correct`}
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                                opt.isCorrect
                                  ? "bg-[#165dfb] text-white shadow-sm shadow-[#165dfb]/30"
                                  : "bg-[#f0eeed] text-[#78716b] hover:bg-[#e2dfdd] hover:text-[#111111]"
                              }`}
                            >
                              {opt.isCorrect ? (
                                <Check
                                  className="h-3.5 w-3.5"
                                  strokeWidth={3}
                                />
                              ) : (
                                String.fromCharCode(65 + oi)
                              )}
                            </button>
                            <input
                              type="text"
                              value={opt.optionText}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              onChange={(e) =>
                                handleUpdateOption(idx, oi, e.target.value)
                              }
                              className={`w-full bg-transparent outline-none placeholder:text-[#a8a29d] ${
                                opt.isCorrect
                                  ? "font-semibold text-[#0f3fa8]"
                                  : "text-[#111111]"
                              }`}
                            />
                            {opt.isCorrect && (
                              <span className="shrink-0 rounded-full bg-[#165dfb]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#165dfb]">
                                Correct
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[14px] border border-dashed border-[#bcd9c9] bg-[#eef8f3] p-6 text-center transition-all hover:border-[#165dfb] hover:bg-[#ecf5ff]">
              <input
                type="file"
                id="csv-upload"
                className="hidden"
                accept=".csv, .json"
                onChange={handleFileUpload}
              />
              <label htmlFor="csv-upload" className="cursor-pointer block">
                <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-[#165dfb]/10">
                  <FileType className="h-5 w-5 text-[#165dfb]" />
                </span>
                <h4 className="text-xs font-bold text-[#111111]">
                  Import via CSV or JSON
                </h4>
                <p className="mt-1 text-[11px] text-[#78716b]">
                  Question, options, then the correct answer
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8] bg-white px-4 py-2 text-xs font-bold shadow-sm transition-all hover:border-[#165dfb] hover:text-[#165dfb]">
                  <Upload className="h-3.5 w-3.5" /> Select File
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddNewQuestion}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[#d1dee8] bg-white py-3.5 text-xs font-bold text-[#165dfb] transition-all hover:border-[#165dfb] hover:bg-[#eef4ff]"
            >
              <PlusCircle className="h-4 w-4" /> Add Custom Question Card
            </button>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#d1dee8] bg-[#f1efff]/50">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between bg-[#f1efff] p-4 text-xs font-bold uppercase tracking-wider text-[#4c3d73] transition-colors hover:bg-[#eae6ff]"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Advanced Settings
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-[#d1dee8]/30"
                >
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Release Scores Instantly",
                        val: publishScoresImmediately,
                        setter: setPublishScoresImmediately,
                      },
                      {
                        label: "Allow Students to View Solutions",
                        val: revealSolutions,
                        setter: setRevealSolutions,
                      },
                      {
                        label: "Enable Negative Marking",
                        val: negativeMarking,
                        setter: setNegativeMarking,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center justify-between gap-3 rounded-[10px] border bg-white p-3.5 transition-all ${
                          item.val
                            ? "border-[#165dfb]/40 shadow-[0_0_0_3px_rgba(22,93,251,0.06)]"
                            : "border-[#d1dee8] hover:border-[#b9cbd9]"
                        }`}
                      >
                        <span className="block text-xs font-bold text-[#111111]">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => item.setter(!item.val)}
                          role="switch"
                          aria-checked={item.val}
                          aria-label={item.label}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#165dfb]/20 ${item.val ? "bg-[#165dfb]" : "bg-[#d1dee8]"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.val ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </div>
    </div>
  );
}
