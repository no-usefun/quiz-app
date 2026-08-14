"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  BarChart3,
  Settings,
  Copy,
  CheckCircle2,
  FileQuestion,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { QuizTest } from "@/lib/types";
import { getStoredTests } from "@/lib/storage";
import { Logo } from "@/components/Logo";
import { useSession } from "@/hooks/useSession";

export default function TeacherDashboard() {
  const { user, logout } = useSession();
  const [tests, setTests] = useState<QuizTest[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const loaded = getStoredTests();
    setTests(loaded);
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
            href="/dashboard/teacher"
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold bg-[#165dfb] text-white transition-all border-0"
          >
            <LayoutDashboard className="h-4 w-4 text-white" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/teacher/create"
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] transition-all"
          >
            <Plus className="h-4 w-4 text-[#78716b]" />
            Create Assessment
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
              {user?.name ? user.name.charAt(0).toUpperCase() : "T"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#111111] truncate">{user?.name || "Educator"}</p>
              <p className="text-[9px] text-[#78716b] font-medium uppercase">Instructor</p>
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
            Educator Control Center
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide mt-0.5">
            Teacher Dashboard
          </h1>
          <p className="text-xs text-[#78716b] font-medium mt-0.5">
            Manage your assessments, copy student invite codes, and monitor live test-taking telemetry.
          </p>
        </section>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Quick Actions Column */}
          <div className="w-full lg:max-w-xs space-y-3 shrink-0">
            <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-5 space-y-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#111111]">Quick Controls</h3>
              <p className="text-[11px] text-[#78716b] font-medium leading-normal">
                Deploy new CSV exams, activate remote environments, or configure results visibility settings.
              </p>
              <Link
                href="/dashboard/teacher/create"
                className="flex w-full items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0"
              >
                <Plus className="h-4 w-4 text-white" />
                Create Assessment
              </Link>
            </div>
          </div>

          {/* Assessments list column */}
          <div className="flex-1 w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-[#111111] -tracking-wide">
                Created Assessments ({tests.length})
              </h3>
              <span className="text-xs font-medium text-[#78716b]">
                Sorted by most recent
              </span>
            </div>

            <div className="grid gap-3.5">
              {tests.length === 0 ? (
                <div className="rounded-[8.8px] bg-white border border-[#d1dee8] p-8 text-center">
                  <FileQuestion className="mx-auto h-8 w-8 text-[#78716b] mb-2" />
                  <p className="font-bold text-[#111111] text-sm">No assessments created yet.</p>
                  <p className="text-xs text-[#78716b] mt-0.5 font-medium">
                    Click &ldquo;Create Assessment&rdquo; to build your first proctored test.
                  </p>
                </div>
              ) : (
                tests.map((test, idx) => (
                  <motion.div
                    key={test.testCode}
                    initial={mounted ? { opacity: 0, y: 4 } : false}
                    animate={mounted ? { opacity: 1, y: 0 } : false}
                    transition={{ delay: idx * 0.04, duration: 0.2, ease: "easeOut" }}
                    className="flex flex-col rounded-[8.8px] bg-white border border-[#d1dee8] p-4 sm:flex-row sm:items-center sm:justify-between transition-all duration-200"
                  >
                    <div className="mb-2 sm:mb-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`rounded-[8.8px] px-2.5 py-0.5 text-[9px] font-bold border border-[#d1dee8]/30 ${
                            test.status === "LIVE"
                              ? "bg-[#e2ede8] text-[#1d5237]"
                              : "bg-[#ece9f3] text-[#4c3d73]"
                          }`}
                        >
                          {test.status}
                        </span>
                        <h4 className="font-extrabold text-[#111111] text-xs -tracking-wide">{test.quizName}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-[#78716b] font-medium">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#78716b]/80" /> {test.targetClass}
                        </span>
                        <span>{test.questions.length} Questions</span>
                        <span>{test.totalTimeLimitMinutes} mins</span>
                        <button
                          type="button"
                          onClick={() => copyCode(test.testCode)}
                          className="flex items-center gap-1 font-mono text-[#165dfb] hover:underline font-bold cursor-pointer bg-transparent border-0"
                        >
                          {copiedCode === test.testCode ? (
                            <><CheckCircle2 className="h-3 w-3 text-[#1d5237]" /> Copied</>
                          ) : (
                            <><Copy className="h-3 w-3 text-[#165dfb]" /> Code: {test.testCode}</>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/teacher/live/${test.testCode}`}
                        className="flex items-center gap-1 rounded-[8.8px] bg-[#165dfb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all duration-200 border-0 cursor-pointer"
                      >
                        <BarChart3 className="h-3 w-3 text-white" /> Monitor
                      </Link>
                      <Link
                        href={`/dashboard/teacher/assessment/${test.testCode}`}
                        className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] active:scale-[0.98] transition-all duration-200 cursor-pointer"
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
