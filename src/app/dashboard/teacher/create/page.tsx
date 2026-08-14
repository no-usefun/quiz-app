"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  Plus,
  Trash2,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GripVertical,
  Sparkles,
  FileText,
  List,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "mcq" | "fitb";

interface MCQQuestion {
  id: number;
  type: "mcq";
  text: string;
  options: [string, string, string, string];
  correctIndex: number | null;
  timeLimit: number; // seconds
  marks: number;
}

interface FITBQuestion {
  id: number;
  type: "fitb";
  text: string;
  correctAnswer: string;
  timeLimit: number;
  marks: number;
}

type Question = MCQQuestion | FITBQuestion;

let nextId = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultQuestion(type: QuestionType, id: number): Question {
  if (type === "mcq") {
    return {
      id,
      type: "mcq",
      text: "",
      options: ["", "", "", ""],
      correctIndex: null,
      timeLimit: 30,
      marks: 1,
    };
  }
  return { id, type: "fitb", text: "", correctAnswer: "", timeLimit: 30, marks: 1 };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SettingRow({
  id,
  label,
  description,
  checked,
  onChange,
  badge,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {badge && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} />
    </div>
  );
}

function QuestionTypeSelector({
  value,
  onChange,
}: {
  value: QuestionType;
  onChange: (t: QuestionType) => void;
}) {
  return (
    <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
      <button
        type="button"
        onClick={() => onChange("mcq")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          value === "mcq"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <List className="h-3.5 w-3.5" />
        MCQ
      </button>
      <button
        type="button"
        onClick={() => onChange("fitb")}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
          value === "fitb"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <FileText className="h-3.5 w-3.5" />
        Fill-in-the-blank
      </button>
    </div>
  );
}

function MCQBody({
  q,
  onChange,
}: {
  q: MCQQuestion;
  onChange: (updated: MCQQuestion) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Answer Options — click the circle to mark the correct one
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {q.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <button
              type="button"
              title="Mark as correct"
              onClick={() => onChange({ ...q, correctIndex: i })}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                q.correctIndex === i
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-200 bg-white text-slate-400 hover:border-emerald-300"
              }`}
            >
              {q.correctIndex === i ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="text-xs font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
              )}
            </button>
            <input
              type="text"
              value={opt}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              onChange={(e) => {
                const options = [...q.options] as MCQQuestion["options"];
                options[i] = e.target.value;
                onChange({ ...q, options });
              }}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:ring-1 ${
                q.correctIndex === i
                  ? "border-emerald-300 bg-emerald-50 focus:border-emerald-400 focus:ring-emerald-200"
                  : "border-slate-200 bg-slate-50 focus:border-blue-400 focus:ring-blue-100 focus:bg-white"
              }`}
            />
          </div>
        ))}
      </div>
      {q.correctIndex === null && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <AlertTriangle className="h-3 w-3" /> Select a correct answer above.
        </p>
      )}
    </div>
  );
}

function FITBBody({
  q,
  onChange,
}: {
  q: FITBQuestion;
  onChange: (updated: FITBQuestion) => void;
}) {
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        Exact Correct Answer
      </p>
      <input
        type="text"
        value={q.correctAnswer}
        placeholder="e.g. Binary Search Tree"
        onChange={(e) => onChange({ ...q, correctAnswer: e.target.value })}
        className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
      />
      <p className="text-[11px] text-slate-400">
        Matching is case-insensitive. The student must type this exactly (or close enough, depending on your grading engine).
      </p>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  onChange,
  onDelete,
  onTypeChange,
}: {
  q: Question;
  index: number;
  onChange: (updated: Question) => void;
  onDelete: () => void;
  onTypeChange: (t: QuestionType) => void;
}) {
  const [open, setOpen] = useState(true);

  function handleTypeChange(newType: QuestionType) {
    if (newType === q.type) return;
    onTypeChange(newType);
  }

  return (
    <div
      className={`rounded-3xl border transition-all ${
        open ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-slate-50"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-300" />

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={q.text}
            placeholder={
              q.type === "mcq"
                ? "Enter your MCQ question…"
                : "Enter your fill-in-the-blank question…"
            }
            onChange={(e) => onChange({ ...q, text: e.target.value })}
            className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
          />
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-slate-400 transition-transform hover:text-slate-600"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          {/* Type + meta row */}
          <div className="flex flex-wrap items-center gap-3">
            <QuestionTypeSelector value={q.type} onChange={handleTypeChange} />

            {/* Time limit */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={q.timeLimit}
                onChange={(e) =>
                  onChange({ ...q, timeLimit: Number(e.target.value) })
                }
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
              >
                {[15, 20, 30, 45, 60, 90, 120].map((s) => (
                  <option key={s} value={s}>
                    {s}s
                  </option>
                ))}
              </select>
            </div>

            {/* Marks */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
              <select
                value={q.marks}
                onChange={(e) =>
                  onChange({ ...q, marks: Number(e.target.value) })
                }
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
              >
                {[1, 2, 3, 4, 5].map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? "mark" : "marks"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic body */}
          {q.type === "mcq" ? (
            <MCQBody
              q={q}
              onChange={(updated) => onChange(updated)}
            />
          ) : (
            <FITBBody
              q={q}
              onChange={(updated) => onChange(updated)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CreateAssessmentPage() {
  // TODO: BACKEND INTEGRATION - Auth guard: on mount, validate token and verify role === 'teacher'.
  // GET /api/auth/validate with Authorization: Bearer {token}. Redirect to /login if invalid.
  const [title, setTitle]                 = useState("");
  const [subject, setSubject]             = useState("");
  const [durationMins, setDurationMins]   = useState(30);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [aiPenalty, setAiPenalty]         = useState(true);
  const [questions, setQuestions]         = useState<Question[]>([
    { id: 1, type: "mcq",  text: "", options: ["", "", "", ""], correctIndex: null, timeLimit: 30, marks: 1 },
    { id: 2, type: "fitb", text: "", correctAnswer: "",                             timeLimit: 30, marks: 1 },
  ]);
  const [saved, setSaved]                 = useState(false);

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

  function addQuestion(type: QuestionType) {
    setQuestions((prev) => [...prev, defaultQuestion(type, nextId++)]);
  }

  function updateQuestion(id: number, updated: Question) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updated : q)));
  }

  function changeQuestionType(id: number, newType: QuestionType) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? defaultQuestion(newType, q.id) : q
      )
    );
  }

  function deleteQuestion(id: number) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function handlePublish() {
    // TODO: BACKEND INTEGRATION - POST /api/assessments with Authorization: Bearer {token}
    // Request body (JSON):
    // {
    //   title: string,
    //   subjectCode: string,
    //   durationMinutes: number,
    //   negativeMarking: boolean,
    //   aiPenaltyEnabled: boolean,
    //   questions: Array<{
    //     type: 'MCQ' | 'FITB',
    //     text: string,
    //     timeLimitSeconds: number,
    //     marks: number,
    //     options?: string[],          // MCQ only
    //     correctOptionIndex?: number, // MCQ only
    //     correctAnswer?: string       // FITB only
    //   }>
    // }
    // Expected response: { assessmentId: number, testCode: string, status: 'CREATED' }
    // On success: router.push(`/dashboard/teacher`) and show a success toast.
    console.log("Publishing assessment:", { title, subject, durationMins, negativeMarking, aiPenalty, questions });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <main className="min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      <div className="mx-auto flex min-h-[90vh] max-w-[900px] flex-col rounded-[2.5rem] bg-white shadow-2xl border border-white/50 overflow-hidden">

        {/* ── Header ── */}
        <header className="flex w-full items-center justify-between border-b border-slate-100 px-8 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/teacher"
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <span className="text-slate-200">|</span>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                DynoQuizz
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 sm:block">
              {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} marks
            </span>
            <button
              onClick={handlePublish}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                saved
                  ? "bg-emerald-600 text-white shadow-emerald-200"
                  : "bg-black text-white shadow-black/10 hover:bg-slate-800"
              }`}
            >
              {saved ? (
                <><CheckCircle2 className="h-4 w-4" /> Published!</>
              ) : (
                "Publish Assessment"
              )}
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-8 p-8 lg:p-10">

          {/* ── Page title ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
              New Assessment
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Create Assessment
            </h1>
          </div>

          {/* ── Basic details ── */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Basic Details
            </h2>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto]">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Assessment Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CS-101 Midterm Examination"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="CS-101"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-mono font-semibold text-slate-900 outline-none transition-all placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 sm:w-32"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Duration
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                  <select
                    value={durationMins}
                    onChange={(e) => setDurationMins(Number(e.target.value))}
                    className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  >
                    {[10, 15, 20, 30, 45, 60, 90, 120].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* ── Exam Settings ── */}
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Exam Settings
            </h2>

            <SettingRow
              id="negative-marking"
              label="Enable Negative Marking"
              description="Deduct ¼ mark for each incorrect MCQ answer. Fill-in-the-blank questions are not affected."
              checked={negativeMarking}
              onChange={setNegativeMarking}
            />

            <SettingRow
              id="ai-penalty"
              label="Automated AI Penalty"
              badge="AI"
              description="Automatically deduct marks for cheating flags detected by the AI proctor (tab switching, fullscreen exits, copy attempts). Turn off to only report flags in the CSV for manual review later."
              checked={aiPenalty}
              onChange={setAiPenalty}
            />

            {/* Summary pill */}
            <div className="flex flex-wrap gap-2 pt-1">
              {negativeMarking && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
                  <AlertTriangle className="h-3 w-3" /> Negative marking active
                </span>
              )}
              {aiPenalty ? (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-700">
                  <Sparkles className="h-3 w-3" /> AI auto-penalty on
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                  AI flags logged to CSV only
                </span>
              )}
            </div>
          </section>

          {/* ── Questions ── */}
          <section className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Questions
              </h2>
              <span className="text-xs text-slate-400">
                {questions.length} question{questions.length !== 1 ? "s" : ""} · {totalMarks} total marks
              </span>
            </div>

            {questions.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 py-16 text-slate-400">
                <FileText className="h-10 w-10" />
                <p className="text-sm font-medium">No questions yet. Add one below.</p>
              </div>
            )}

            <div className="space-y-3">
              {questions.map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  index={idx}
                  onChange={(updated) => updateQuestion(q.id, updated)}
                  onDelete={() => deleteQuestion(q.id)}
                  onTypeChange={(t) => changeQuestionType(q.id, t)}
                />
              ))}
            </div>

            {/* Add question buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => addQuestion("mcq")}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add MCQ
              </button>
              <button
                type="button"
                onClick={() => addQuestion("fitb")}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add Fill-in-the-blank
              </button>
            </div>
          </section>

          {/* ── Footer CTA ── */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400">
              Assessment code will be generated automatically on publish.
            </p>
            <button
              onClick={handlePublish}
              className={`flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                saved
                  ? "bg-emerald-600 text-white shadow-emerald-200"
                  : "bg-black text-white shadow-black/10 hover:bg-slate-800"
              }`}
            >
              {saved ? (
                <><CheckCircle2 className="h-4 w-4" /> Published!</>
              ) : (
                "Publish Assessment"
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
