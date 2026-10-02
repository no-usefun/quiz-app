"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Users,
  Clock,
  BookOpen,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { ENDPOINTS } from "@/lib/api/endpoints";

type QuizData = {
  quizId?: number | string;
  quizCode?: string;
  title?: string;
  subject?: string;
  totalStudents?: number;
  totalQuestions?: number;
  questions?: unknown[];
  overallTimerSeconds?: number;
  status?: string;
  examState?: string;
  allowedRegistrationNumbers?: string[];
};

function normalizeQuiz(raw: any): QuizData | null {
  if (!raw || typeof raw !== "object") return null;

  return {
    ...raw,
    quizId: raw.quizId ?? raw.id,
    quizCode: raw.quizCode ?? raw.testCode ?? "",
    title: raw.title ?? raw.quizName ?? raw.quizTitle ?? "Assessment Session",
    subject: raw.subject ?? raw.subjectName ?? "",
    totalStudents: Number(raw.totalStudents ?? 0),
    totalQuestions:
      raw.totalQuestions ??
      (Array.isArray(raw.questions) ? raw.questions.length : 0),
    overallTimerSeconds: Number(raw.overallTimerSeconds ?? 0),
    allowedRegistrationNumbers: Array.isArray(raw.allowedRegistrationNumbers)
      ? raw.allowedRegistrationNumbers
      : Array.isArray(raw.allowedRegistrationNos)
        ? raw.allowedRegistrationNos
        : [],
  };
}

export default function ShareAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [resolvedCode, setResolvedCode] = useState(testCode);

  useEffect(() => {
    let cancelled = false;

    const fetchQuizDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("dynoquizz_token");

        if (!token) {
          throw new Error(
            "Your teacher session has expired. Please log in again.",
          );
        }

        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        // Current backend source of truth:
        // GET /api/v1/teacher/quizzes -> List<QuizResponse>
        // This lets us resolve either a quiz ID or the human-readable quiz code.
        const rosterRes = await fetch(ENDPOINTS.teacher.quizzes, {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (!rosterRes.ok) {
          const errData = await rosterRes.json().catch(() => ({}));
          throw new Error(
            errData?.message ||
              errData?.error ||
              `Unable to load your assessments (${rosterRes.status}).`,
          );
        }

        const rosterData = await rosterRes.json();

        const list: any[] = Array.isArray(rosterData)
          ? rosterData
          : Array.isArray(rosterData?.content)
            ? rosterData.content
            : Array.isArray(rosterData?.data)
              ? rosterData.data
              : [];

        let matched = list.find(
          (q) =>
            String(q?.quizCode ?? q?.testCode ?? "") === String(testCode) ||
            String(q?.quizId ?? q?.id ?? "") === String(testCode),
        );

        // When the URL contains a numeric quiz ID and the roster did not
        // resolve it, use the current teacher detail endpoint.
        if (!matched && /^\d+$/.test(String(testCode))) {
          const detailRes = await fetch(
            ENDPOINTS.teacher.quizDetail(testCode),
            {
              method: "GET",
              headers,
              cache: "no-store",
            },
          );

          if (detailRes.ok) {
            matched = await detailRes.json();
          }
        }

        const normalized = normalizeQuiz(matched);

        if (!normalized) {
          throw new Error(
            "Assessment not found. Check the assessment URL or return to the teacher dashboard.",
          );
        }

        const code = String(normalized.quizCode || "").trim();

        if (!code) {
          throw new Error(
            "Assessment was found, but the backend did not return its access code.",
          );
        }

        if (cancelled) return;

        setResolvedCode(code);
        setQuizData(normalized);
      } catch (e: any) {
        if (cancelled) return;

        console.error("Failed to load quiz for sharing:", e);
        setQuizData(null);
        setError(
          e?.message ||
            "We couldn't retrieve the assessment details from the server.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchQuizDetails();

    return () => {
      cancelled = true;
    };
  }, [testCode]);

  const assessmentLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${encodeURIComponent(resolvedCode)}`
      : `/join?code=${encodeURIComponent(resolvedCode)}`;

  const copyToClipboard = async (text: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);

      if (type === "link") {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans">
        <TopNav role="teacher" />
        <main className="flex-1 flex items-center justify-center text-xs font-bold text-[#78716b]">
          Synchronizing assessment details from server...
        </main>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans">
        <TopNav role="teacher" />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="rounded-[14px] bg-[#fbeee8] border border-[#8c381c]/30 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
            <AlertCircle className="h-10 w-10 text-[#8c381c] mx-auto opacity-80" />
            <h2 className="text-lg font-extrabold text-[#8c381c]">
              Connection Error
            </h2>
            <p className="text-xs text-[#8c381c] font-medium leading-relaxed">
              {error}
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard/teacher"
                className="inline-flex items-center justify-center rounded-[10px] bg-[#8c381c] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#6e2b14] active:scale-[0.98] transition-all shadow-xs"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const title = quizData.title || "Assessment Session";
  const totalQuestions =
    quizData.totalQuestions ||
    (Array.isArray(quizData.questions) ? quizData.questions.length : 0);
  const timeLimitMins = Math.floor((quizData.overallTimerSeconds || 0) / 60);

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col">
      <TopNav role="teacher" />

      <main className="flex-1 p-4 md:p-8 space-y-6 text-left max-w-4xl mx-auto w-full">
        <header className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#d1dee8]/80 bg-white text-[#78716b] hover:border-[#b9cbd9] hover:text-[#111111] shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
                ASSESSMENT DISTRIBUTION
              </span>
              <h1 className="text-xl font-extrabold text-[#111111] -tracking-wide mt-0.5">
                Share Assessment
              </h1>
            </div>
          </div>
        </header>

        <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1dee8]/30 pb-6">
            <div>
              <span className="rounded-full bg-[#e2ede8] text-[#1d5237] px-2.5 py-0.5 text-[10px] font-bold border border-[#1d5237]/20">
                {String(quizData.status || "").toUpperCase() === "PUBLISHED"
                  ? "PUBLISHED & ACTIVE"
                  : String(quizData.status || "ASSESSMENT").toUpperCase()}
              </span>

              <h2 className="text-2xl font-black text-[#111111] mt-2">
                {title}
              </h2>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#78716b] font-medium">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {quizData.subject || "General Subject"}
                </span>

                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {quizData.totalStudents || 0} Target Students
                </span>

                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {timeLimitMins} mins · {totalQuestions} Qs
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/teacher/live/${resolvedCode}`}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-sm shadow-[#165dfb]/20 active:scale-[0.98] transition-all"
              >
                <BarChart3 className="h-4 w-4 text-white" />
                Monitor Live Stream
              </Link>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/50 p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Session Access Code
              </span>

              <div className="flex items-center justify-between bg-white border border-[#d1dee8]/80 p-3 rounded-[10px] shadow-xs">
                <span className="font-mono text-lg font-black text-[#165dfb] tracking-wider">
                  {resolvedCode.toUpperCase()}
                </span>

                <button
                  type="button"
                  onClick={() => copyToClipboard(resolvedCode, "code")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#f5f5f4] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] text-xs font-bold text-[#111111] transition-all cursor-pointer border border-[#d1dee8]/60 shadow-xs active:scale-95"
                >
                  {copiedCode ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#78716b]" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#78716b] font-medium">
                Candidates type this code on the join portal.
              </p>
            </div>

            <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/50 p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Direct Candidate Link
              </span>

              <div className="flex items-center justify-between bg-white border border-[#d1dee8]/80 p-3 rounded-[10px] overflow-hidden shadow-xs">
                <span className="font-mono text-xs text-[#78716b] truncate pr-2">
                  {assessmentLink}
                </span>

                <button
                  type="button"
                  onClick={() => copyToClipboard(assessmentLink, "link")}
                  className="flex shrink-0 items-center gap-1 px-3 py-1.5 rounded-[8px] bg-[#f5f5f4] hover:bg-[#e6e3e2] hover:border-[#b9cbd9] text-xs font-bold text-[#111111] transition-all cursor-pointer border border-[#d1dee8]/60 shadow-xs active:scale-95"
                >
                  {copiedLink ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#78716b]" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-[#78716b] font-medium">
                Share this direct link so candidates can open the join portal.
              </p>
            </div>
          </div>

          {/* Authorized Whitelisted Students */}
          <div className="rounded-[12px] border border-[#d1dee8]/70 bg-[#f5f5f4]/50 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#165dfb]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                  Authorized Students Whitelist
                </span>
              </div>
              <span className="rounded-full bg-white border border-[#d1dee8]/80 px-2.5 py-0.5 text-[11px] font-bold text-[#165dfb] shadow-2xs">
                {quizData.allowedRegistrationNumbers && quizData.allowedRegistrationNumbers.length > 0
                  ? `${quizData.allowedRegistrationNumbers.length} Authorized Students`
                  : "Open to All Students (No Roll Number Restriction)"}
              </span>
            </div>

            {quizData.allowedRegistrationNumbers && quizData.allowedRegistrationNumbers.length > 0 ? (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] text-[#78716b] font-medium">
                  Only the following student registration numbers are authorized to take this assessment:
                </p>
                <div className="flex flex-wrap gap-2">
                  {quizData.allowedRegistrationNumbers.map((regNo: string, idx: number) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[8px] bg-white border border-[#165dfb]/30 font-mono text-xs font-bold text-[#165dfb] shadow-2xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#165dfb]" />
                      {regNo}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#78716b] font-medium leading-relaxed">
                This assessment is set to <strong>Open Access</strong>. Any registered student who enters the 6-digit access code can attempt the quiz without roll number restrictions.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-[#d1dee8]/30 flex justify-end gap-3">
            <Link
              href="/dashboard/teacher"
              className="px-5 py-2.5 rounded-[10px] bg-[#165dfb] text-xs font-bold text-white hover:bg-[#0f4fd8] shadow-sm shadow-[#165dfb]/20 active:scale-[0.98] transition-all"
            >
              Back to Educator Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
