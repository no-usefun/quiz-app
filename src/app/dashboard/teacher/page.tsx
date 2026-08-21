"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Plus,
  Users,
  BarChart3,
  Copy,
  CheckCircle2,
  FileQuestion,
  BookOpen,
  Edit2,
} from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { useSession } from "@/hooks/useSession";
import { getStoredTests } from "@/lib/storage";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export default function TeacherDashboard() {
  const { user } = useSession();
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const fetchQuizzes = async () => {
      const localTests = getStoredTests().map((t) => ({
        quizCode: t.testCode,
        title: t.quizName,
        subject: t.subject || "Computer Science",
        subjectCode: t.subjectCode || t.testCode,
        totalStudents: 50,
        totalQuestions: t.questions?.length || 0,
        overallTimerSeconds: (t.totalTimeLimitMinutes || 30) * 60,
        status: t.status || "PUBLISHED",
      }));

      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const data = await res.json();
          const backendList = Array.isArray(data) ? data : [];
          // Merge avoiding duplicates by code
          const seen = new Set(backendList.map((b: any) => (b.quizCode || b.testCode || "").toUpperCase()));
          const combined = [...backendList, ...localTests.filter((l) => !seen.has(l.quizCode.toUpperCase()))];
          setTests(combined);
        } else {
          setTests(localTests);
        }
      } catch (e) {
        setTests(localTests);
      } finally {
        setLoading(false);
      }
    };

    fetchQuizzes();
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const displayName =
    user?.name || user?.fullName || user?.firstName || "Instructor";
  const liveCount = tests.filter(
    (t) =>
      (t.status || "").toUpperCase() === "PUBLISHED" ||
      (t.status || "").toUpperCase() === "LIVE",
  ).length;
  const draftCount = tests.filter(
    (t) => (t.status || "").toUpperCase() === "DRAFT",
  ).length;

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex flex-col">
      <TopNav role="teacher" />

      <main className="flex-1 p-4 md:p-8 space-y-6 text-left max-w-7xl mx-auto w-full">
        <section className="border-b border-[#d1dee8]/50 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Educator Control Center
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide mt-0.5">
              Welcome back, {displayName}
            </h1>
            <p className="text-xs text-[#78716b] font-medium mt-0.5">
              Manage your assessments, invite candidates, and monitor live exam
              telemetry.
            </p>
          </div>

          <Link
            href="/dashboard/teacher/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 shadow-none"
          >
            <Plus className="h-4 w-4 text-white" />
            Create Assessment
          </Link>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Total Assessments
            </span>
            <p className="text-2xl font-black text-[#111111] mt-1">
              {loading ? "..." : tests.length}
            </p>
          </div>
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1d5237]">
              Active / Live Sessions
            </span>
            <p className="text-2xl font-black text-[#1d5237] mt-1">
              {loading ? "..." : liveCount}
            </p>
          </div>
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
              Draft Assessments
            </span>
            <p className="text-2xl font-black text-[#78716b] mt-1">
              {loading ? "..." : draftCount}
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#111111] uppercase tracking-wider">
              Assessments Roster ({tests.length})
            </h2>
            <span className="text-xs font-medium text-[#78716b]">
              Sorted chronologically
            </span>
          </div>

          <div className="grid gap-3.5">
            {loading ? (
              <div className="rounded-[8.8px] bg-white border border-[#d1dee8] p-10 text-center text-xs text-[#78716b]">
                Loading assessments roster...
              </div>
            ) : tests.length === 0 ? (
              <div className="rounded-[8.8px] bg-white border border-[#d1dee8] p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#f5f5f4] text-[#78716b] border border-[#d1dee8]">
                  <FileQuestion className="h-6 w-6 text-[#78716b]" />
                </div>
                <div>
                  <p className="font-bold text-[#111111] text-sm">
                    No assessments created yet
                  </p>
                  <p className="text-xs text-[#78716b] mt-0.5 font-medium max-w-sm mx-auto">
                    Click &ldquo;Create Assessment&rdquo; to build your first
                    proctored test.
                  </p>
                </div>
                <Link
                  href="/dashboard/teacher/create"
                  className="inline-flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all border-0"
                >
                  <Plus className="h-3.5 w-3.5 text-white" /> Create Assessment
                </Link>
              </div>
            ) : (
              tests.map((test, idx) => {
                const code = test.quizCode || test.testCode || "CODE";
                const name = test.title || test.quizName || "Assessment";
                const status = test.status || "PUBLISHED";

                return (
                  <motion.div
                    key={code + idx}
                    initial={mounted ? { opacity: 0, y: 4 } : false}
                    animate={mounted ? { opacity: 1, y: 0 } : false}
                    transition={{
                      delay: idx * 0.03,
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    className="flex flex-col rounded-[8.8px] bg-white border border-[#d1dee8] p-4 sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-[#165dfb]/40 transition-all duration-200"
                  >
                    <div className="min-w-0 text-left space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-[8.8px] px-2.5 py-0.5 text-[9px] font-bold border border-[#d1dee8]/30 ${
                            status === "PUBLISHED" || status === "LIVE"
                              ? "bg-[#e2ede8] text-[#1d5237]"
                              : status === "DRAFT"
                                ? "bg-[#f6efe1] text-[#73561a]"
                                : "bg-[#ece9f3] text-[#4c3d73]"
                          }`}
                        >
                          {status}
                        </span>
                        <h3 className="font-extrabold text-[#111111] text-sm -tracking-wide truncate">
                          {name}
                        </h3>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#78716b] font-medium">
                        {test.subject && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3 text-[#78716b]/80" />{" "}
                            {test.subject}
                            {test.subjectCode ? ` (${test.subjectCode})` : ""}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#78716b]/80" />{" "}
                          {test.totalStudents || 0} Students
                        </span>
                        <span>{test.totalQuestions || 0} Questions</span>
                        <span>
                          {Math.floor((test.overallTimerSeconds || 3600) / 60)}{" "}
                          mins
                        </span>

                        {status !== "DRAFT" && (
                          <button
                            type="button"
                            onClick={() => copyCode(code)}
                            className="flex items-center gap-1 font-mono text-[#165dfb] hover:underline font-bold cursor-pointer bg-transparent border-0"
                          >
                            {copiedCode === code ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-[#1d5237]" />{" "}
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 text-[#165dfb]" />{" "}
                                Code: {code}
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {status === "DRAFT" ? (
                        <Link
                          href={`/dashboard/teacher/create?draftId=${code}`}
                          className="flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-5 py-1.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> Edit Draft
                        </Link>
                      ) : (
                        <>
                          <Link
                            href={`/dashboard/teacher/share/${code}`}
                            className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Share
                          </Link>
                          <Link
                            href={`/dashboard/teacher/live/${code}`}
                            className="flex items-center gap-1 rounded-[8.8px] bg-[#165dfb] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all border-0 cursor-pointer"
                          >
                            <BarChart3 className="h-3 w-3 text-white" /> Monitor
                          </Link>
                          <Link
                            href={`/dashboard/teacher/assessment/${code}`}
                            className="flex items-center gap-1 rounded-[8.8px] border border-[#d1dee8] bg-white px-3 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Results
                          </Link>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
