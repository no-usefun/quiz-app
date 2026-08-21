"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
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
import { saveTest } from "@/lib/storage";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export default function CreateAssessmentPage() {
  const router = useRouter();
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
  const [className, setClassName] = useState("CS-201 Section A");
  const [allowedRollsText, setAllowedRollsText] = useState("");
  const [timeLimit, setTimeLimit] = useState(30); // in minutes

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [publishScoresImmediately, setPublishScoresImmediately] = useState(true);
  const [revealSolutions, setRevealSolutions] = useState(true);
  const [showIntegrityFlagsToStudent, setShowIntegrityFlagsToStudent] =
    useState(false);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
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
            setValidationError("JSON file must contain a non-empty array of questions.");
            setParsedQuestions([]);
            return;
          }

          const validated: any[] = [];

          for (let idx = 0; idx < rawList.length; idx++) {
            const q = rawList[idx];
            const qNum = idx + 1;

            const qText = (q.questionText || q.text || "").trim();
            if (!qText) {
              setValidationError(`Question ${qNum}: 'questionText' is required and cannot be empty.`);
              setParsedQuestions([]);
              return;
            }

            if (q.marks !== undefined && q.marks !== null) {
              const numMarks = Number(q.marks);
              if (isNaN(numMarks) || numMarks <= 0) {
                setValidationError(`Question ${qNum}: 'marks' must be a positive number, got '${q.marks}'.`);
                setParsedQuestions([]);
                return;
              }
            }

            if (q.negativeMarks !== undefined && q.negativeMarks !== null) {
              const numNeg = Number(q.negativeMarks);
              if (isNaN(numNeg) || numNeg < 0) {
                setValidationError(`Question ${qNum}: 'negativeMarks' must be a non-negative number.`);
                setParsedQuestions([]);
                return;
              }
            }

            if (!Array.isArray(q.options) || q.options.length < 2) {
              setValidationError(`Question ${qNum}: At least 2 options are required, got ${Array.isArray(q.options) ? q.options.length : 0}.`);
              setParsedQuestions([]);
              return;
            }

            let normalizedOpts: any[] = [];

            if (typeof q.options[0] === "string") {
              const strOpts: string[] = q.options.map((o: any) => String(o).trim());
              const correctStr = (q.correctOption || q.correctAnswer || q.answer || "").trim();

              if (!correctStr) {
                setValidationError(`Question ${qNum}: 'correctOption' must be specified.`);
                setParsedQuestions([]);
                return;
              }

              const matchedIndex = strOpts.findIndex(
                (o) => o.toLowerCase() === correctStr.toLowerCase() ||
                       (correctStr.length === 1 && String.fromCharCode(65 + strOpts.indexOf(o)) === correctStr.toUpperCase())
              );

              if (matchedIndex === -1 && !strOpts.includes(correctStr)) {
                setValidationError(`Question ${qNum}: 'correctOption' ("${correctStr}") does not match any of the provided options (${strOpts.join(", ")}).`);
                setParsedQuestions([]);
                return;
              }

              normalizedOpts = strOpts.map((optText, oIdx) => ({
                optionText: optText,
                optionImage: null,
                optionOrder: oIdx + 1,
                isCorrect: oIdx === (matchedIndex !== -1 ? matchedIndex : strOpts.indexOf(correctStr)),
              }));
            } else {
              let correctCount = 0;
              for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
                const opt = q.options[oIdx];
                const optText = (opt.optionText || opt.text || "").trim();
                if (!optText) {
                  setValidationError(`Question ${qNum}, Option ${oIdx + 1}: Option text cannot be empty.`);
                  setParsedQuestions([]);
                  return;
                }
                if (opt.isCorrect) correctCount++;
              }

              if (correctCount === 0) {
                setValidationError(`Question ${qNum}: Exactly one option must be marked as correct ('isCorrect': true).`);
                setParsedQuestions([]);
                return;
              }

              normalizedOpts = q.options.map((opt: any, oIdx: number) => ({
                optionText: (opt.optionText || opt.text).trim(),
                optionImage: opt.optionImage || null,
                optionOrder: opt.optionOrder || oIdx + 1,
                isCorrect: !!opt.isCorrect,
              }));
            }

            validated.push({
              questionText: qText,
              imageUrl: q.imageUrl || null,
              explanation: q.explanation || "",
              questionType: q.questionType || "MCQ",
              marks: Number(q.marks) || 1,
              negativeMarks: q.negativeMarks !== undefined ? Number(q.negativeMarks) : (negativeMarking ? 0.25 : 0),
              questionTimerSeconds: q.questionTimerSeconds || null,
              difficulty: q.difficulty || "MEDIUM",
              displayOrder: qNum,
              options: normalizedOpts,
            });
          }

          setParsedQuestions(validated);
        } catch (err: any) {
          setValidationError(`Failed to parse JSON file: ${err?.message || "Invalid JSON format"}`);
          setParsedQuestions([]);
        }
      } else {
        // CSV Parsing with strict schema validation
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length === 0) {
          setValidationError("CSV file is empty.");
          setParsedQuestions([]);
          return;
        }

        // Detect and skip header row
        const firstLineLower = lines[0].toLowerCase();
        const hasHeader =
          firstLineLower.includes("question") ||
          firstLineLower.includes("option a") ||
          firstLineLower.includes("correct");

        const contentLines = hasHeader ? lines.slice(1) : lines;
        if (contentLines.length === 0) {
          setValidationError("CSV file contains a header but no question rows.");
          setParsedQuestions([]);
          return;
        }

        const validatedQuestions: any[] = [];

        for (let index = 0; index < contentLines.length; index++) {
          const rowNum = hasHeader ? index + 2 : index + 1;
          const line = contentLines[index];
          const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));

          if (parts.length < 3) {
            setValidationError(`Row ${rowNum}: Insufficient columns. Minimum required format: Question, Option A, Option B, [Option C, Option D], Correct Option.`);
            setParsedQuestions([]);
            return;
          }

          const qText = parts[0];
          if (!qText) {
            setValidationError(`Row ${rowNum}: Question text cannot be empty.`);
            setParsedQuestions([]);
            return;
          }

          const optA = parts[1] || "";
          const optB = parts[2] || "";
          const optC = parts[3] || "";
          const optD = parts[4] || "";
          const correctIdentifier = (parts[5] || parts[parts.length - 1] || "").trim();

          if (!optA || !optB) {
            setValidationError(`Row ${rowNum}: At least Option A and Option B must be non-empty.`);
            setParsedQuestions([]);
            return;
          }

          if (parts[6] !== undefined && parts[6] !== "") {
            const marksVal = Number(parts[6]);
            if (isNaN(marksVal) || marksVal <= 0) {
              setValidationError(`Row ${rowNum}: 'marks' must be a positive number, got '${parts[6]}'.`);
              setParsedQuestions([]);
              return;
            }
          }

          const availableOptions = [
            { text: optA, letter: "A" },
            { text: optB, letter: "B" },
            ...(optC ? [{ text: optC, letter: "C" }] : []),
            ...(optD ? [{ text: optD, letter: "D" }] : []),
          ];

          let matchedOptIndex = availableOptions.findIndex(
            (o) => o.letter.toUpperCase() === correctIdentifier.toUpperCase() ||
                   o.text.toLowerCase() === correctIdentifier.toLowerCase()
          );

          if (matchedOptIndex === -1) {
            setValidationError(`Row ${rowNum}: Correct option '${correctIdentifier}' does not match any provided option (A: "${optA}", B: "${optB}"${optC ? `, C: "${optC}"` : ""}${optD ? `, D: "${optD}"` : ""}).`);
            setParsedQuestions([]);
            return;
          }

          const formattedOptions = availableOptions.map((opt, oIdx) => ({
            optionText: opt.text,
            optionImage: null,
            optionOrder: oIdx + 1,
            isCorrect: oIdx === matchedOptIndex,
          }));

          validatedQuestions.push({
            questionText: qText,
            imageUrl: null,
            explanation: "",
            questionType: "MCQ",
            marks: parts[6] ? Number(parts[6]) : 1,
            negativeMarks: negativeMarking ? 0.25 : 0,
            questionTimerSeconds: null,
            difficulty: "MEDIUM",
            displayOrder: index + 1,
            options: formattedOptions,
          });
        }

        setParsedQuestions(validatedQuestions);
      }
    };
    reader.readAsText(file);
  };

  const handleAddNewQuestion = () => {
    setValidationError(null);
    const newQ = {
      questionText: "",
      imageUrl: null,
      explanation: "",
      questionType: "MCQ",
      marks: 1,
      negativeMarks: negativeMarking ? 0.25 : 0,
      questionTimerSeconds: null,
      difficulty: "MEDIUM",
      displayOrder: parsedQuestions.length + 1,
      options: [
        { optionText: "", optionImage: null, optionOrder: 1, isCorrect: true },
        { optionText: "", optionImage: null, optionOrder: 2, isCorrect: false },
        { optionText: "", optionImage: null, optionOrder: 3, isCorrect: false },
        { optionText: "", optionImage: null, optionOrder: 4, isCorrect: false },
      ],
    };
    setParsedQuestions((prev) => [...prev, newQ]);
  };

  const handleUpdateQuestionField = (idx: number, field: string, value: any) => {
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
      prev.filter((_, i) => i !== idx).map((q, i) => ({ ...q, displayOrder: i + 1 })),
    );
  };

  const handleSave = async (e: React.FormEvent, status = "PUBLISHED") => {
    e.preventDefault();
    if (!title.trim()) {
      setValidationError("Please enter an assessment title.");
      return;
    }

    if (parsedQuestions.length === 0) {
      setValidationError("Please add at least one question before publishing.");
      return;
    }

    setSubmitting(true);
    setValidationError(null);

    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();

    const startTimeISO = new Date().toISOString();
    const endTimeISO = new Date(Date.now() + 86400000 * 7).toISOString();

    const formattedQuestions = parsedQuestions.map((q, idx) => ({
      questionText: q.questionText.trim() || `Question ${idx + 1}`,
      imageUrl: q.imageUrl || null,
      explanation: q.explanation || "",
      questionType: q.questionType || "MCQ",
      marks: Number(q.marks) || 1,
      negativeMarks: negativeMarking ? Number(negativeMarks) || 0.25 : 0,
      questionTimerSeconds: q.questionTimerSeconds || null,
      difficulty: q.difficulty || "MEDIUM",
      displayOrder: idx + 1,
      options: (q.options || []).map((opt: any, oIdx: number) => ({
        optionText: opt.optionText.trim() || `Option ${String.fromCharCode(65 + oIdx)}`,
        optionImage: opt.optionImage || null,
        optionOrder: oIdx + 1,
        isCorrect: !!opt.isCorrect,
      })),
    }));

    const allowedRegistrationNumbers = allowedRollsText
      .split(/[\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    saveTest({
      testCode: generatedCode,
      quizName: title.trim(),
      description: description.trim() || "Assessment Session",
      subject: subject.trim(),
      subjectCode: subjectCode.trim(),
      targetClass: className.trim(),
      totalTimeLimitMinutes: timeLimit,
      passingMarks: 40,
      allowedRegistrationNumbers,
      settings: {
        negativeMarking,
        automatedAiPenalty: false,
        publishScoresImmediately,
        revealSolutions,
        showIntegrityFlagsToStudent,
      },
      createdAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      status: "LIVE",
      questions: formattedQuestions.map((q, idx) => ({
        id: idx + 1,
        text: q.questionText,
        options: q.options.map((o: any) => o.optionText),
        correctOption:
          q.options.find((o: any) => o.isCorrect)?.optionText ||
          q.options[0]?.optionText ||
          "Option A",
      })),
    });

    try {
      const token = localStorage.getItem("dynoquizz_token");
      const payload = {
        teacherId: 4,
        title: title.trim(),
        description: description.trim() || "Assessment evaluation package",
        instructions: instructions.trim() || "Read all questions carefully before submitting.",
        subject: subject.trim(),
        subjectCode: subjectCode.trim(),
        totalStudents: 50,
        overallTimerSeconds: timeLimit * 60,
        negativeMarking: !!negativeMarking,
        negativeMarks: negativeMarking ? Number(negativeMarks) || 0.25 : 0,
        timeBonusEnabled: false,
        randomQuestionOrder: true,
        randomOptionOrder: true,
        allowReview: true,
        allowResume: true,
        autoSubmit: true,
        startTime: startTimeISO,
        endTime: endTimeISO,
        allowedRegistrationNumbers,
        questions: formattedQuestions,
      };

      const res = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const code = data.quizCode || data.testCode || generatedCode;
        if (code !== generatedCode) {
          saveTest({
            testCode: code,
            quizName: title.trim(),
            description: description.trim() || "Assessment Session",
            subject: subject.trim(),
            subjectCode: subjectCode.trim(),
            targetClass: className.trim(),
            totalTimeLimitMinutes: timeLimit,
            settings: {
              negativeMarking,
              automatedAiPenalty: false,
              publishScoresImmediately,
              revealSolutions,
              showIntegrityFlagsToStudent,
            },
            createdAt: new Date().toLocaleDateString(),
            status: "LIVE",
            questions: formattedQuestions.map((q, idx) => ({
              id: idx + 1,
              text: q.questionText,
              options: q.options.map((o: any) => o.optionText),
              correctOption:
                q.options.find((o: any) => o.isCorrect)?.optionText ||
                q.options[0]?.optionText ||
                "Option A",
            })),
          });
        }
        router.push(`/dashboard/teacher/share/${code}`);
      } else {
        router.push(`/dashboard/teacher/share/${generatedCode}`);
      }
    } catch (err) {
      console.warn("Backend sync failed, using local session:", err);
      router.push(`/dashboard/teacher/share/${generatedCode}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 selection:bg-[#e6e3e2] selection:text-[#165dfb] text-left">
      <div className="mx-auto max-w-4xl space-y-6">
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
                Build secure exams synced dynamically with your Spring Boot backend.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleSave(e, "PUBLISHED")}
              disabled={submitting}
              className="rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 disabled:opacity-40 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Publish Assessment"}
            </button>
          </div>
        </header>

        {validationError && (
          <div className="rounded-[8.8px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold">
            {validationError}
          </div>
        )}

        <form
          onSubmit={(e) => handleSave(e, "PUBLISHED")}
          className="space-y-6"
        >
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
                  rows={3}
                  placeholder="Test your understanding of arrays, trees, graphs, sorting..."
                  className={inputClass}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
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
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
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
                <div className="text-left">
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                    TIME LIMIT (MINUTES)
                  </label>
                  <div className="flex items-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-2">
                    <Clock className="h-4 w-4 text-[#78716b]" />
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="text-left sm:col-span-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                      Authorized Student Roll Numbers / Whitelist (Optional)
                    </label>
                    <span className="text-[9px] text-[#78716b] font-medium">Comma or newline separated</span>
                  </div>
                  <textarea
                    value={allowedRollsText}
                    onChange={(e) => setAllowedRollsText(e.target.value)}
                    rows={2}
                    placeholder="e.g. 21BCE1001, 21BCE1002, 21BCE1003 (leave blank to allow all candidates)"
                    className={inputClass}
                  />
                  <p className="mt-1 text-[10px] text-[#78716b] font-medium">
                    When configured, only candidates with matching student registration numbers will be authorized to join.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
                QUESTIONS ({parsedQuestions.length})
              </h3>
              <span className="rounded-full bg-[#eef4ff] border border-[#d1dee8]/30 px-2 py-0.5 text-[10px] font-bold text-[#165dfb]">
                {parsedQuestions.length} questions
              </span>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="rounded-[8.8px] border border-dashed border-[#d1dee8] bg-white p-8 text-center text-xs text-[#78716b]">
                No questions added yet. Click <strong>&ldquo;Add Custom Question Card&rdquo;</strong> below or import via CSV/JSON.
              </div>
            ) : (
              <div className="space-y-4">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-[8.8px] border border-[#d1dee8] bg-white p-5 space-y-4 hover:border-[#165dfb]/55 transition-colors relative"
                  >
                    <div className="flex items-center justify-between border-b border-[#d1dee8]/30 pb-2">
                      <span className="font-mono text-xs font-bold text-[#78716b]">
                        Question 0{idx + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-[#78716b] uppercase">Marks:</label>
                          <input
                            type="number"
                            min="1"
                            value={q.marks || 1}
                            onChange={(e) => handleUpdateQuestionField(idx, "marks", Number(e.target.value))}
                            className="w-12 rounded border border-[#d1dee8] bg-[#f5f5f4] px-1 py-0.5 text-center text-xs font-bold text-[#165dfb]"
                          />
                        </div>
                        <select
                          value={q.difficulty || "MEDIUM"}
                          onChange={(e) => handleUpdateQuestionField(idx, "difficulty", e.target.value)}
                          className="rounded border border-[#d1dee8] bg-[#f5f5f4] px-2 py-0.5 text-[10px] font-bold text-[#111111] outline-none"
                        >
                          <option value="EASY">EASY</option>
                          <option value="MEDIUM">MEDIUM</option>
                          <option value="HARD">HARD</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          className="text-[#8c381c] hover:text-red-700 transition-colors cursor-pointer border-0 bg-transparent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-[#78716b]">Question Text</label>
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestionField(idx, "questionText", e.target.value)}
                        placeholder="Enter question statement..."
                        className="w-full rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-2.5 text-xs font-bold text-[#111111] outline-none focus:border-[#165dfb] focus:bg-white"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-[#78716b]">Options (Select Correct Answer)</label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(q.options || []).map((opt: any, oi: number) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2 rounded-[8.8px] border p-2 text-xs transition-colors ${
                              opt.isCorrect
                                ? "border-[#165dfb] bg-[#eef4ff]"
                                : "border-[#d1dee8] bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(idx, oi)}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all cursor-pointer border-0 ${
                                opt.isCorrect
                                  ? "bg-[#165dfb] text-white"
                                  : "bg-[#e6e3e2] text-[#78716b] hover:bg-[#d1dee8]"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}
                            </button>
                            <input
                              type="text"
                              value={opt.optionText}
                              onChange={(e) => handleUpdateOption(idx, oi, e.target.value)}
                              placeholder={`Option ${String.fromCharCode(65 + oi)} text...`}
                              className="w-full bg-transparent text-xs font-medium text-[#111111] outline-none"
                              required
                            />
                            {opt.isCorrect && (
                              <span className="shrink-0 rounded bg-[#165dfb] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
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

            <div className="rounded-[8.8px] border border-dashed border-[#d1dee8] bg-[#eef8f3] p-6 text-center hover:border-[#165dfb] transition-all">
              <input
                type="file"
                id="csv-upload-builder"
                className="hidden"
                accept=".csv, .json"
                onChange={handleFileUpload}
              />
              <label
                htmlFor="csv-upload-builder"
                className="cursor-pointer block"
              >
                <FileType className="mx-auto mb-2 h-7 w-7 text-[#165dfb]" />
                <h4 className="text-xs font-extrabold text-[#111111] -tracking-wide">
                  Import Questions via CSV or JSON
                </h4>
                <p className="mt-0.5 text-[10px] text-[#78716b] font-medium leading-normal max-w-sm mx-auto">
                  {fileName
                    ? `Imported ${parsedQuestions.length} questions from file "${fileName}"`
                    : "Upload CSV or JSON files containing QuestionText, Options, and CorrectAnswer."}
                </p>
                <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-[8.8px] border border-[#d1dee8] bg-white px-4 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2]/40 transition-all">
                  <Upload className="h-3.5 w-3.5 text-[#78716b]" /> Select File (CSV / JSON)
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddNewQuestion}
              className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] border border-dashed border-[#d1dee8] bg-white py-3 text-xs font-bold text-[#165dfb] hover:bg-[#eef4ff] transition-all cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" /> Add Custom Question Card
            </button>
          </div>

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
                    <div className="text-left space-y-1">
                      <span className="text-[9px] font-bold text-[#78716b] uppercase">
                        Target Class
                      </span>
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        className="w-full rounded-[8.8px] border border-[#d1dee8] bg-white p-2.5 text-xs text-[#111111]"
                      />
                    </div>
                    <div className="text-left space-y-1">
                      <span className="text-[9px] font-bold text-[#78716b] uppercase">
                        Assessment Instructions
                      </span>
                      <input
                        type="text"
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
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
                        label: "Enable Negative Marking",
                        hint: "Deduct 0.25 points for incorrect selections.",
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

          <div className="pt-6 border-t border-[#d1dee8]/50 text-center space-y-4">
            <h3 className="text-xs font-extrabold text-[#78716b] uppercase tracking-wider">
              Ready to publish?
            </h3>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => handleSave(e, "DRAFT")}
                className="rounded-[8.8px] border border-[#d1dee8] bg-white px-5 py-2.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2]/40 active:scale-[0.98] transition-all cursor-pointer"
              >
                Save Draft
              </button>
              <button
                type="submit"
                disabled={!title.trim() || submitting}
                className="rounded-[8.8px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 disabled:opacity-40 cursor-pointer"
              >
                {submitting ? "Publishing..." : "Publish Assessment"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
