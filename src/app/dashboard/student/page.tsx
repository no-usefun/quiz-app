"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  PlayCircle,
  CalendarDays,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { getStoredResults } from "@/lib/storage";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function gradeBadgeClass(grade: string) {
  if (!grade) return "bg-[#fbeee8] text-[#8c381c]";
  const upper = grade.toUpperCase();
  if (upper.startsWith("A")) return "bg-[#e2ede8] text-[#1d5237]";
  if (upper.startsWith("B")) return "bg-[#ece9f3] text-[#4c3d73]";
  if (upper.startsWith("C")) return "bg-[#f6efe1] text-[#73561a]";
  return "bg-[#fbeee8] text-[#8c381c]";
}

export default function StudentDashboard() {
  const { user } = useSession();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      const localResults = getStoredResults().map((r) => ({
        testCode: r.testCode,
        quizName: r.quizName,
        submittedAt: r.submittedAt || "Recently",
        totalQuestions: r.totalQuestions || 0,
        score: r.rawScore || 0,
        adjustedScore: r.adjustedScore || r.rawScore || 0,
        grade: r.grade || "A",
        published: true,
      }));

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(`${API_BASE}/api/v1/student/results`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const backendList = Array.isArray(data) ? data : [];
          const seen = new Set(backendList.map((b: any) => (b.testCode || b.id || "").toUpperCase()));
          const combined = [...backendList, ...localResults.filter((l) => !seen.has(l.testCode.toUpperCase()))];
          setResults(combined);
        } else {
          setResults(localResults);
        }
      } catch (e) {
        setResults(localResults);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);
  const displayName =
    user?.fullName || user?.firstName || user?.name || "Student User";
  const publishedCount = results.filter(
    (r) => r.published || r.isPublished,
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col">
      <TopNav role="student" />

      <main className="flex-1 p-4 md:p-8 space-y-6 text-left max-w-7xl mx-auto w-full">
        <section className="border-b border-[#d1dee8]/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Student Assessment Portal
            </span>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide">
              Welcome back, {displayName}
            </h1>
            <p className="mt-0.5 text-xs text-[#78716b] font-medium">
              Join active exam sessions with your access credentials and view
              your submitted scorecards.
            </p>
          </div>

          <Link
            href="/join"
            className="inline-flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-none"
          >
            <PlayCircle className="h-4 w-4 text-white" />
            Join Assessment
          </Link>
        </section>

        <section className="rounded-[8.8px] bg-white border border-[#d1dee8] p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#165dfb]">
                Active Exam Access
              </span>
              <h2 className="text-lg font-extrabold text-[#111111] -tracking-wide">
                Join a Proctored Assessment
              </h2>
              <p className="max-w-md text-xs text-[#78716b] leading-relaxed font-medium">
                Enter your Session Access Code along with your registered
                Student Roll / Registration Number to verify your environment
                and begin.
              </p>
              <Link
                href="/join"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0"
              >
                <PlayCircle className="h-4 w-4 text-white" />
                Join Assessment
                <ChevronRight className="h-4 w-4 text-white/90" />
              </Link>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] text-[#165dfb] border border-[#d1dee8]">
              <ClipboardList className="h-6 w-6 text-[#165dfb]" />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 flex items-center gap-3">
            <div className="rounded-[8.8px] p-2.5 bg-[#f5f5f4] text-[#165dfb] border border-[#d1dee8]">
              <ClipboardList className="h-4 w-4 text-[#165dfb]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#111111]">
                {loading ? "..." : results.length}
              </p>
              <p className="text-[9px] text-[#78716b] font-bold uppercase">
                Tests Submitted
              </p>
            </div>
          </div>

          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 flex items-center gap-3">
            <div className="rounded-[8.8px] p-2.5 bg-[#e2ede8] text-[#1d5237] border border-[#d1dee8]/30">
              <CheckCircle2 className="h-4 w-4 text-[#1d5237]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#111111]">
                {loading ? "..." : publishedCount} Released
              </p>
              <p className="text-[9px] text-[#78716b] font-bold uppercase">
                Released Grades
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">
            Recent Assessments ({results.length})
          </h2>

          <div className="rounded-[8.8px] bg-white border border-[#d1dee8] overflow-hidden">
            <ul className="divide-y divide-[#d1dee8]">
              {loading ? (
                <li className="p-8 text-center text-xs text-[#78716b]">
                  Loading submissions...
                </li>
              ) : results.length === 0 ? (
                <li className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]">
                    <ClipboardList className="h-6 w-6 text-[#78716b]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111111]">
                      No assessments taken yet
                    </p>
                    <p className="mt-0.5 text-xs text-[#78716b] font-medium max-w-xs mx-auto">
                      Join your first assessment using the session code and
                      registration number provided by your instructor.
                    </p>
                  </div>
                  <Link
                    href="/join"
                    className="mt-1 inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-colors border-0"
                  >
                    <PlayCircle className="h-3.5 w-3.5 text-white" /> Join an
                    Assessment
                  </Link>
                </li>
              ) : (
                results.map((result, idx) => {
                  const isPublished =
                    result.published ?? result.isPublished ?? true;

                  if (isPublished) {
                    return (
                      <li key={idx}>
                        <Link
                          href={`/dashboard/student/result/${result.testCode || result.id}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-[#f5f5f4] group"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-xs font-bold text-[#111111] group-hover:text-[#165dfb] transition-colors">
                              {result.quizName ||
                                result.title ||
                                "Assessment Session"}
                            </span>
                            <div className="flex items-center gap-3 text-[10px] text-[#78716b] font-medium">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3 text-[#78716b]/80" />
                                {result.submittedAt || "Just now"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-[#78716b]/80" />
                                {result.totalQuestions || 0} Qs
                              </span>
                              <span className="font-mono font-bold text-[#78716b] bg-[#f5f5f4] px-1.5 py-0.5 rounded border border-[#d1dee8]/40">
                                {result.testCode || "CODE"}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="flex flex-col items-end text-[10px]">
                              <span className="font-bold text-[#1d5237]">
                                Score:{" "}
                                {result.score || result.adjustedScore || 0}%
                              </span>
                              <span className="text-[#78716b] font-bold uppercase text-[8px]">
                                Grade {result.grade || "A"}
                              </span>
                            </div>
                            <span
                              className={`inline-flex min-w-[1.8rem] items-center justify-center rounded-[8.8px] px-2 py-0.5 text-[10px] font-bold border border-[#d1dee8]/20 ${gradeBadgeClass(
                                result.grade || "A",
                              )}`}
                            >
                              {result.grade || "A"}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-[#d1dee8]" />
                          </div>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={idx}>
                      <div className="flex items-center justify-between gap-4 px-4 py-3.5 cursor-not-allowed bg-[#f5f5f4]/50">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#78716b]">
                              {result.quizName || result.title}
                            </span>
                            <span className="rounded-[8.8px] bg-[#ece9f3] px-2 py-0.5 text-[8px] font-bold text-[#4c3d73] border border-[#d1dee8]/30">
                              Locked
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-[#78716b]/80 font-medium">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 text-[#78716b]/60" />
                              {result.submittedAt}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-[#78716b]/60" />
                              {result.totalQuestions || 0} Qs
                            </span>
                            <span className="font-mono font-bold text-[#78716b]/70 bg-[#f5f5f4] px-1.5 py-0.5 rounded border border-[#d1dee8]/40">
                              {result.testCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-[8.8px] bg-[#f6efe1] px-2.5 py-0.5 text-[9px] font-bold text-[#73561a] border border-[#d1dee8]/30">
                            <Lock className="h-3 w-3 text-[#73561a]" />
                            Under Review
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
