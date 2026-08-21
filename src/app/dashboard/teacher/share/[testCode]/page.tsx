"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  Share2,
  Users,
  Clock,
  BookOpen,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export default function ShareAssessmentPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);
  const { user } = useSession();
  const [quizData, setQuizData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const fetchQuizDetails = async () => {
      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(
          `${API_BASE}/api/v1/quizzes/code/${testCode}/package`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          setQuizData(data);
        } else {
          setQuizData(null);
        }
      } catch (e) {
        console.error("Failed to load quiz package for sharing:", e);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizDetails();
  }, [testCode]);

  const assessmentLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/join?code=${testCode}`
      : `http://localhost:3000/join?code=${testCode}`;

  const copyToClipboard = (text: string, type: "link" | "code") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans">
        <TopNav role="teacher" />
        <main className="flex-1 flex items-center justify-center text-xs text-[#78716b]">
          Loading assessment distribution package...
        </main>
      </div>
    );
  }

  const title = quizData?.title || quizData?.quizName || "Assessment Session";
  const totalQuestions =
    quizData?.totalQuestions || quizData?.questions?.length || 0;
  const timeLimitMins = Math.floor(
    (quizData?.overallTimerSeconds || 3600) / 60,
  );

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col">
      <TopNav role="teacher" />

      <main className="flex-1 p-4 md:p-8 space-y-6 text-left max-w-4xl mx-auto w-full">
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
                ASSESSMENT DISTRIBUTION
              </span>
              <h1 className="text-xl font-extrabold text-[#111111] -tracking-wide mt-0.5">
                Share Assessment
              </h1>
            </div>
          </div>
        </header>

        <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-6 md:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d1dee8]/30 pb-6">
            <div>
              <span className="rounded-full bg-[#e2ede8] text-[#1d5237] px-2.5 py-0.5 text-[10px] font-bold border border-[#d1dee8]/30">
                PUBLISHED &amp; ACTIVE
              </span>
              <h2 className="text-2xl font-black text-[#111111] mt-2">
                {title}
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-[#78716b] font-medium">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />{" "}
                  {quizData?.subject || "Computer Science"}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />{" "}
                  {quizData?.totalStudents || 0} Target Students
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {timeLimitMins} mins ·{" "}
                  {totalQuestions} Qs
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/teacher/live/${testCode}`}
                className="inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all shadow-none"
              >
                <BarChart3 className="h-4 w-4 text-white" /> Monitor Live Stream
              </Link>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4]/50 p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Session Access Code
              </span>
              <div className="flex items-center justify-between bg-white border border-[#d1dee8] p-3 rounded-[8.8px]">
                <span className="font-mono text-lg font-black text-[#165dfb] tracking-wider">
                  {testCode.toUpperCase()}
                </span>
                <button
                  onClick={() => copyToClipboard(testCode, "code")}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-[8.8px] bg-[#f5f5f4] hover:bg-[#e6e3e2] text-xs font-bold text-[#111111] transition-colors cursor-pointer border-0"
                >
                  {copiedCode ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />{" "}
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#78716b]" /> Copy Code
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#78716b] font-medium">
                Candidates type this code along with their registration number
                on the join portal.
              </p>
            </div>

            <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4]/50 p-5 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Direct Candidate Link
              </span>
              <div className="flex items-center justify-between bg-white border border-[#d1dee8] p-3 rounded-[8.8px] overflow-hidden">
                <span className="font-mono text-xs text-[#78716b] truncate pr-2">
                  {assessmentLink}
                </span>
                <button
                  onClick={() => copyToClipboard(assessmentLink, "link")}
                  className="flex shrink-0 items-center gap-1 px-3 py-1.5 rounded-[8.8px] bg-[#f5f5f4] hover:bg-[#e6e3e2] text-xs font-bold text-[#111111] transition-colors cursor-pointer border-0"
                >
                  {copiedLink ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />{" "}
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-[#78716b]" /> Copy Link
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#78716b] font-medium">
                Share this direct link via email or messaging groups for instant
                authentication.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#d1dee8]/30 flex justify-end gap-3">
            <Link
              href="/dashboard/teacher"
              className="px-5 py-2.5 rounded-[8.8px] bg-[#165dfb] text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all"
            >
              Back to Educator Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
