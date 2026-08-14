"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Plus,
  Users,
  BarChart3,
  Settings,
  Copy,
  CheckCircle2,
  FileQuestion,
} from "lucide-react";
import { QuizTest } from "@/lib/types";
import { getStoredTests } from "@/lib/storage";
import { ProfileDropdown } from "@/components/ProfileDropdown";

export default function TeacherDashboard() {
  const [tests, setTests] = useState<QuizTest[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getStoredTests();
    setTimeout(() => setTests(loaded), 0);
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-850 selection:bg-blue-105 selection:text-blue-900">
      {/* Top Nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-905">
            DynoQuizz
          </span>
        </div>
        <ProfileDropdown initial="T" roleName="Instructor Account" />
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col p-1 lg:flex-row gap-6">
          <div className="flex-1 lg:max-w-xs space-y-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Educator Control Center
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 mt-0.5 mb-1">
                Teacher Dashboard
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Manage your assessments and monitor live student telemetry.
              </p>
            </div>

            <Link
              href="/dashboard/teacher/create"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Create Assessment
            </Link>

            <Link
              href="/settings"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-55 hover:border-slate-350 transition-all shadow-xs"
            >
              <Settings className="h-4 w-4" />
              Global Settings
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Created Assessments ({tests.length})
              </h3>
              <span className="text-xs font-medium text-slate-400">
                Sorted by most recent
              </span>
            </div>

            <div className="grid gap-3">
              {tests.length === 0 ? (
                <div className="rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-xs">
                  <FileQuestion className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-bold text-slate-900 text-sm">No assessments created yet.</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Click &ldquo;Create Assessment&rdquo; to build your first proctored test.
                  </p>
                </div>
              ) : (
                tests.map((test, idx) => (
                  <motion.div
                    key={test.testCode}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.2, ease: "easeOut" }}
                    whileHover={{ y: -1 }}
                    className="flex flex-col rounded-2xl bg-white border border-slate-200 p-4 shadow-xs hover:shadow-sm sm:flex-row sm:items-center sm:justify-between transition-all"
                  >
                    <div className="mb-2 sm:mb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                            test.status === "LIVE"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-slate-100 border-slate-200 text-slate-650"
                          }`}
                        >
                          {test.status}
                        </span>
                        <h4 className="font-bold text-slate-950 text-xs">{test.quizName}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {test.targetClass}
                        </span>
                        <span>{test.questions.length} Questions</span>
                        <span>{test.totalTimeLimitMinutes} mins</span>
                        <button
                          type="button"
                          onClick={() => copyCode(test.testCode)}
                          className="flex items-center gap-1 font-mono text-blue-600 hover:underline font-bold"
                        >
                          {copiedCode === test.testCode ? (
                            <><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Copied</>
                          ) : (
                            <><Copy className="h-3 w-3" /> Code: {test.testCode}</>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/dashboard/teacher/live/${test.testCode}`}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
                      >
                        <BarChart3 className="h-3 w-3" /> Monitor
                      </Link>
                      <Link
                        href={`/dashboard/teacher/assessment/${test.testCode}`}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
                      >
                        Results
                      </Link>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
