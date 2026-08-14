"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  PlayCircle,
  CalendarDays,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle2,
  Settings,
  LogOut,
  LayoutDashboard,
} from "lucide-react";
import { StudentTestResult, QuizTest } from "@/lib/types";
import { getStoredResults, getTestByCode } from "@/lib/storage";
import { Logo } from "@/components/Logo";
import { useSession } from "@/hooks/useSession";

function gradeBadgeClass(grade: string) {
  if (grade.startsWith("A")) return "bg-pastel-mint text-pastel-mint-text";
  if (grade.startsWith("B")) return "bg-pastel-lavender text-pastel-lavender-text";
  if (grade.startsWith("C")) return "bg-pastel-yellow text-pastel-yellow-text";
  return "bg-pastel-pink text-pastel-pink-text";
}

export default function StudentDashboard() {
  const { user, logout } = useSession();
  const router = useRouter();
  const [results, setResults] = useState<StudentTestResult[]>([]);
  const [testsMap, setTestsMap] = useState<Record<string, QuizTest>>({});

  useEffect(() => {
    const loadedResults = getStoredResults();
    const map: Record<string, QuizTest> = {};
    loadedResults.forEach((r) => {
      const t = getTestByCode(r.testCode);
      if (t) map[r.testCode] = t;
    });
    setResults(loadedResults);
    setTestsMap(map);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-[#f5f5f4] border-r border-[#d1dee8] flex flex-col shrink-0">
        {/* Header Logo */}
        <div className="p-6 border-b border-[#d1dee8]/50">
          <Logo />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 text-left">
          <Link
            href="/dashboard/student"
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold bg-[#165dfb] text-white transition-all"
          >
            <LayoutDashboard className="h-4 w-4 text-white" />
            Dashboard
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] transition-all"
          >
            <Settings className="h-4 w-4 text-[#78716b]" />
            Settings
          </Link>
        </nav>

        {/* User Card & Sign Out bottom */}
        <div className="p-4 border-t border-[#d1dee8]/50 text-left space-y-3">
          <div className="flex items-center gap-2.5 px-2.5 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6e3e2] border border-[#d1dee8] text-xs font-bold text-[#111111]">
              {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#111111] truncate">{user?.name || "Student User"}</p>
              <p className="text-[9px] text-[#78716b] font-medium uppercase">Student</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-white py-2 text-xs font-bold text-[#8c381c] hover:bg-[#fbeee8] transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-[#8c381c]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-left">
        {/* Welcome Header */}
        <section className="border-b border-[#d1dee8]/50 pb-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
            Student Portal
          </span>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide">
            Welcome Back, {user?.name || "Student"} 👋
          </h1>
          <p className="mt-0.5 text-xs text-[#78716b] font-medium">
            Access active exam sessions and track your submitted performance scorecards.
          </p>
        </section>

        {/* Primary CTA — Join Assessment */}
        <section className="rounded-[8.8px] bg-white border border-[#d1dee8] p-6 md:p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#165dfb]">
                Active Exam Access
              </span>
              <h2 className="text-lg font-extrabold text-[#111111] -tracking-wide">Join an Assessment</h2>
              <p className="max-w-sm text-xs text-[#78716b] leading-relaxed font-medium">
                Enter your 6-character session code to start the secure environment checks and download the exam.
              </p>
              <Link
                href="/join"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-colors border-0"
              >
                <PlayCircle className="h-4 w-4 text-white" />
                Join Assessment
                <ChevronRight className="h-4 w-4 text-white/90" />
              </Link>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#e6e3e2] text-[#165dfb] border border-[#d1dee8]/50">
              <ClipboardList className="h-6 w-6 text-[#165dfb]" />
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 flex items-center gap-3">
            <div className="rounded-[8.8px] p-2 bg-[#e6e3e2] text-[#165dfb] border border-[#d1dee8]/30">
              <ClipboardList className="h-4 w-4 text-[#165dfb]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#111111]">{results.length}</p>
              <p className="text-[9px] text-[#78716b] font-bold uppercase">Tests Submitted</p>
            </div>
          </div>

          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 flex items-center gap-3">
            <div className="rounded-[8.8px] p-2 bg-[#e2ede8] text-[#1d5237]">
              <CheckCircle2 className="h-4 w-4 text-[#1d5237]" />
            </div>
            <div>
              <p className="text-xl font-bold text-[#111111]">
                {results.filter((r) => testsMap[r.testCode]?.settings?.publishScoresImmediately).length} Released
              </p>
              <p className="text-[9px] text-[#78716b] font-bold uppercase">Released Grades</p>
            </div>
          </div>
        </section>

        {/* Recent Results */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-[#111111] uppercase tracking-wider">Recent Assessments ({results.length})</h2>

          <div className="rounded-[8.8px] bg-white border border-[#d1dee8] overflow-hidden">
            <ul className="divide-y divide-[#d1dee8]">
              {results.length === 0 ? (
                <li className="p-6 text-center text-xs text-[#78716b] font-medium">
                  No assessments taken yet.
                </li>
              ) : (
                results.map((result, idx) => {
                  const targetTest = testsMap[result.testCode];
                  const isPublished = targetTest?.settings?.publishScoresImmediately ?? false;

                  if (isPublished) {
                    return (
                      <li key={idx}>
                        <Link
                          href={`/dashboard/student/result/${result.testCode}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-[#e6e3e2]/30 group"
                        >
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-xs font-bold text-[#111111] group-hover:text-[#165dfb] transition-colors">
                              {result.quizName}
                            </span>
                            <div className="flex items-center gap-3 text-[10px] text-[#78716b] font-medium">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="h-3 w-3 text-[#78716b]/80" />
                                {result.submittedAt}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-[#78716b]/80" />
                                {result.totalQuestions} Qs
                              </span>
                              <span className="font-mono font-bold text-[#78716b]/90 bg-[#e6e3e2] px-1 rounded">
                                {result.testCode}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <div className="flex flex-col items-end text-[10px]">
                              <span className="font-bold text-[#1d5237]">
                                Score: {result.adjustedScore}%
                              </span>
                              <span className="text-[#78716b] font-bold uppercase text-[8px]">
                                Grade {result.grade}
                              </span>
                            </div>
                            <span
                              className={`inline-flex min-w-[1.8rem] items-center justify-center rounded-[8.8px] px-2 py-0.5 text-[10px] font-bold ${gradeBadgeClass(
                                result.grade,
                              )}`}
                            >
                              {result.grade}
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 text-[#d1dee8]" />
                          </div>
                        </Link>
                      </li>
                    );
                  }

                  return (
                    <li key={idx}>
                      <div className="flex items-center justify-between gap-4 px-4 py-3.5 cursor-not-allowed bg-[#e6e3e2]/20">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-bold text-[#78716b]">
                              {result.quizName}
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
                              {result.totalQuestions} Qs
                            </span>
                            <span className="font-mono font-bold text-[#78716b]/70 bg-[#e6e3e2] px-1 rounded">
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
