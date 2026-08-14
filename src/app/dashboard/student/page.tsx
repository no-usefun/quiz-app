"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ClipboardList,
  PlayCircle,
  CalendarDays,
  Clock,
  ChevronRight,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { StudentTestResult, QuizTest } from "@/lib/types";
import { getStoredResults, getTestByCode } from "@/lib/storage";
import { ProfileDropdown } from "@/components/ProfileDropdown";

function gradeBadgeClass(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (grade.startsWith("B")) return "bg-blue-50 text-blue-705 border-blue-100";
  if (grade.startsWith("C")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function StudentDashboard() {
  const [results, setResults] = useState<StudentTestResult[]>([]);
  const [testsMap, setTestsMap] = useState<Record<string, QuizTest>>({});

  useEffect(() => {
    const loadedResults = getStoredResults();
    const map: Record<string, QuizTest> = {};
    loadedResults.forEach((r) => {
      const t = getTestByCode(r.testCode);
      if (t) map[r.testCode] = t;
    });
    setTimeout(() => {
      setResults(loadedResults);
      setTestsMap(map);
    }, 0);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-850 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900">
            DynoQuizz
          </span>
        </div>
        <ProfileDropdown />
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Welcome Header */}
        <section>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Student Portal
          </span>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">
            Welcome Back 👋
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Join an active assessment or review your submitted tests.
          </p>
        </section>

        {/* Primary CTA — Join Assessment */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          whileHover={{ y: -1 }}
          className="rounded-2xl bg-blue-600 border border-blue-700 p-6 text-white shadow-xs"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                Active Exam Access
              </span>
              <h2 className="mt-0.5 text-xl font-bold text-white">Join an Assessment</h2>
              <p className="mt-1 max-w-sm text-xs text-blue-50 leading-relaxed font-medium">
                Enter your 6-character session code to start the offline package download and identity verification.
              </p>
              <Link
                href="/join"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-5 py-2.5 text-xs font-bold text-blue-605 hover:bg-slate-50 active:scale-95 transition-all shadow-xs"
              >
                <PlayCircle className="h-4 w-4 text-blue-600" />
                Join Assessment
                <ChevronRight className="h-4 w-4 text-blue-650" />
              </Link>
            </div>
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white border border-white/10">
              <ShieldCheck className="h-6 w-6" />
            </div>
          </div>
        </motion.section>

        {/* Stats Strip */}
        <section className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="rounded-lg p-2 bg-slate-50 text-slate-700 border border-slate-200">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{results.length}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Tests Submitted</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex items-center gap-3">
            <div className="rounded-lg p-2 bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">
                {results.filter((r) => testsMap[r.testCode]?.settings?.publishScoresImmediately).length} Released
              </p>
              <p className="text-[10px] text-slate-500 font-bold uppercase">Released Grades</p>
            </div>
          </div>
        </section>

        {/* Recent Results */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900">Recent Assessments ({results.length})</h2>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-xs">
            <ul className="divide-y divide-slate-100">
              {results.map((result, idx) => {
                const targetTest = testsMap[result.testCode];
                const isPublished = targetTest?.settings?.publishScoresImmediately ?? false;

                if (isPublished) {
                  return (
                    <motion.li
                      key={idx}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.2, ease: "easeOut" }}
                    >
                      <Link
                        href={`/dashboard/student/result/${result.testCode}`}
                        className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-slate-50/50 group"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {result.quizName}
                          </span>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {result.submittedAt}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {result.totalQuestions} Qs
                            </span>
                            <span className="font-mono font-bold">
                              {result.testCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col items-end text-[10px]">
                            <span className="font-bold text-emerald-800">
                              Released: {result.adjustedScore}%
                            </span>
                            <span className="text-slate-400 font-bold uppercase text-[8px]">
                              Grade {result.grade}
                            </span>
                          </div>
                          <span
                            className={`inline-flex min-w-[1.8rem] items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${gradeBadgeClass(
                              result.grade,
                            )}`}
                          >
                            {result.grade}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                        </div>
                      </Link>
                    </motion.li>
                  );
                }

                return (
                  <motion.li
                    key={idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.2, ease: "easeOut" }}
                  >
                    <div className="flex items-center justify-between gap-4 px-4 py-3.5 cursor-not-allowed bg-slate-50/30">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-slate-400">
                            {result.quizName}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[8px] font-bold text-slate-500 border border-slate-200">
                            Locked
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {result.submittedAt}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {result.totalQuestions} Qs
                          </span>
                          <span className="font-mono font-bold">
                            {result.testCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[9px] font-bold text-amber-705">
                          <Lock className="h-3 w-3 text-amber-600" />
                          Pending Review
                        </span>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
