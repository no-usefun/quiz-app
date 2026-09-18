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
              difficulty: q.difficulty || "EASY",
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
                difficulty: "EASY",
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
        difficulty: "EASY",
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

    const allowedRegistrationNumbers = allowedRollsText
      .split(/[\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const now = new Date();
    const endTime = new Date(now.getTime() + timeLimit * 60000);

    try {
      // STRICT MAPPING to provided JSON request schema
      const payload = {
        teacherId: Number(safeTeacherId > 0 ? safeTeacherId : 1),
        title: String(title.trim()),
        description: String(description.trim()),
        instructions: String(instructions.trim()),
        subject: String(subject.trim()),
        subjectCode: String(subjectCode.trim()),
        totalStudents: Number(allowedRegistrationNumbers.length),
        overallTimerSeconds: Number(timeLimit * 60),
        negativeMarking: Boolean(negativeMarking),
        negativeMarks: Number(negativeMarking ? negativeMarks : 0),
        timeBonusEnabled: Boolean(true),
        randomQuestionOrder: Boolean(true),
        randomOptionOrder: Boolean(true),
        allowReview: Boolean(true),
        allowResume: Boolean(true),
        autoSubmit: Boolean(true),
        startTime: String(now.toISOString()),
        endTime: String(endTime.toISOString()),
        questions: parsedQuestions.map((q: any, index: number) => ({
          questionText: String(q.questionText),
          imageUrl: String(""),
          explanation: String(q.explanation || ""),
          questionType: String("MCQ"),
          marks: Number(q.marks || 1),
          negativeMarks: Number(negativeMarking ? negativeMarks : 0),
          questionTimerSeconds: Number(q.questionTimerSeconds || 60),
          difficulty: String(q.difficulty || "EASY"),
          displayOrder: Number(index + 1),
          options: q.options.map((opt: any, optIndex: number) => ({
            optionText: String(opt.optionText),
            optionImage: String(""),
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
          `Server returned status: ${res.status}. Check backend console for details.`,
        );
      }

      const data = await res.json();
      router.push(`/dashboard/teacher/share/${data.quizCode}`);
    } catch (err: any) {
      console.error("Failed to create quiz:", err);
      setValidationError(`Failed to create assessment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3 text-xs text-[#111111] outline-none transition-all focus:border-[#165dfb] focus:bg-white font-medium";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 text-left">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex h-8 w-8 items-center justify-center rounded-[8.8px] border border-[#d1dee8] bg-white text-[#78716b] hover:bg-[#e6e3e2]/40 transition-all"
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
            </div>
          </div>
          <button
            onClick={(e) => handleSave(e)}
            disabled={submitting}
            className="rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 disabled:opacity-40"
          >
            {submitting ? "Publishing..." : "Publish Assessment"}
          </button>
        </header>

        {validationError && (
          <div className="rounded-[8.8px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold">
            {validationError}
          </div>
        )}

        <form onSubmit={(e) => handleSave(e)} className="space-y-6">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-6 space-y-5">
            <h3 className="text-xs font-bold uppercase text-[#111111] border-b border-[#d1dee8]/30 pb-2.5">
              Assessment Details
            </h3>
            <div className="space-y-4">
              <div className="text-left">
                <label className="mb-1.5 block text-[10px] font-bold uppercase text-[#78716b]">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms — Midterm"
                  className={inputClass}
                  required
                />
              </div>
              <div className="text-left">
                <label className="mb-1.5 block text-[10px] font-bold uppercase text-[#78716b]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase text-[#78716b]">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase text-[#78716b]">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase text-[#78716b]">
                    TIME LIMIT (MINUTES)
                  </label>
                  <div className="flex items-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-2">
                    <Clock className="h-4 w-4 text-[#78716b]" />
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      min="1"
                      className="bg-transparent outline-none w-full text-xs font-bold text-[#111111]"
                      required
                    />
                  </div>
                </div>
                <div className="text-left sm:col-span-3">
                  <label className="text-[10px] font-bold uppercase text-[#78716b] mb-1.5 block">
                    Authorized Student Roll Numbers (Optional)
                  </label>
                  <textarea
                    value={allowedRollsText}
                    onChange={(e) => setAllowedRollsText(e.target.value)}
                    rows={2}
                    placeholder="Comma separated, e.g. 21BCE1001, 21BCE1002"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
              <h3 className="text-xs font-bold uppercase text-[#111111]">
                QUESTIONS ({parsedQuestions.length})
              </h3>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="rounded-[8.8px] border border-dashed border-[#d1dee8] bg-white p-8 text-center text-xs text-[#78716b]">
                No questions added yet.
              </div>
            ) : (
              <div className="space-y-4">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-[8.8px] border border-[#d1dee8] bg-white p-5 space-y-4 relative"
                  >
                    <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
                      <span className="font-mono text-xs font-bold text-[#78716b]">
                        Question 0{idx + 1}
                      </span>
                      <div className="flex gap-3 items-center">
                        <label className="text-[10px] font-bold text-[#78716b]">
                          Marks:
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
                          className="w-12 border p-1 rounded text-center text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="text-[#8c381c] hover:opacity-70"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
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
                      placeholder="Question text"
                      className="w-full border p-2 text-xs rounded outline-none"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      {q.options.map((opt: any, oi: number) => (
                        <div
                          key={oi}
                          className={`flex items-center gap-2 border p-2 text-xs rounded ${opt.isCorrect ? "border-[#165dfb] bg-[#eef4ff]" : "bg-white"}`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSetCorrectOption(idx, oi)}
                            className={`h-6 w-6 rounded-full text-xs font-bold ${opt.isCorrect ? "bg-[#165dfb] text-white" : "bg-[#e6e3e2]"}`}
                          >
                            {String.fromCharCode(65 + oi)}
                          </button>
                          <input
                            type="text"
                            value={opt.optionText}
                            onChange={(e) =>
                              handleUpdateOption(idx, oi, e.target.value)
                            }
                            className="w-full bg-transparent outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[8.8px] border border-dashed border-[#d1dee8] bg-[#eef8f3] p-6 text-center hover:border-[#165dfb] transition-all">
              <input
                type="file"
                id="csv-upload"
                className="hidden"
                accept=".csv, .json"
                onChange={handleFileUpload}
              />
              <label htmlFor="csv-upload" className="cursor-pointer block">
                <FileType className="mx-auto mb-2 h-7 w-7 text-[#165dfb]" />
                <h4 className="text-xs font-bold">Import via CSV or JSON</h4>
                <div className="mt-3 inline-flex items-center gap-1.5 border bg-white px-4 py-1.5 text-xs font-bold rounded hover:bg-[#e6e3e2]/40">
                  <Upload className="h-3.5 w-3.5" /> Select File
                </div>
              </label>
            </div>
            <button
              type="button"
              onClick={handleAddNewQuestion}
              className="flex w-full items-center justify-center gap-1.5 border border-dashed bg-white py-3 text-xs font-bold text-[#165dfb] hover:bg-[#eef4ff] rounded"
            >
              <PlusCircle className="h-4 w-4" /> Add Custom Question Card
            </button>
          </div>

          <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f1efff]/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-4 bg-[#f1efff] text-xs font-bold text-[#4c3d73]"
            >
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4" /> ADVANCED SETTINGS
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
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
                  <div className="p-4 grid gap-4 sm:grid-cols-2">
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
                        className="flex items-center justify-between border p-3 rounded bg-white"
                      >
                        <span className="block text-xs font-bold text-[#111111]">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => item.setter(!item.val)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${item.val ? "bg-[#165dfb]" : "bg-[#d1dee8]"}`}
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
