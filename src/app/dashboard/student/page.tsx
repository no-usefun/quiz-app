"use client";

import Link from "next/link";
import {
  ShieldCheck,
  ClipboardList,
  PlayCircle,
  CalendarDays,
  Clock,
  TrendingUp,
  Award,
  LogOut,
  ChevronRight,
} from "lucide-react";

const recentResults = [
  {
    id: 1,
    subject: "Data Structures & Algorithms",
    code: "CS-201",
    score: 88,
    adjustedScore: 83,
    date: "Jul 28, 2026",
    duration: "58 min",
    grade: "A",
  },
  {
    id: 2,
    subject: "Operating Systems",
    code: "CS-301",
    score: 74,
    adjustedScore: 69,
    date: "Jul 22, 2026",
    duration: "62 min",
    grade: "B",
  },
  {
    id: 3,
    subject: "Computer Networks",
    code: "CS-401",
    score: 91,
    adjustedScore: 90,
    date: "Jul 15, 2026",
    duration: "55 min",
    grade: "A+",
  },
  {
    id: 4,
    subject: "Database Management Systems",
    code: "CS-302",
    score: 66,
    adjustedScore: 61,
    date: "Jul 8, 2026",
    duration: "70 min",
    grade: "C+",
  },
];

function gradeColor(grade: string) {
  if (grade.startsWith("A")) return "text-emerald-600 bg-emerald-50";
  if (grade.startsWith("B")) return "text-blue-600 bg-blue-50";
  if (grade.startsWith("C")) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export default function StudentDashboard() {
  // TODO: BACKEND INTEGRATION - Auth guard: on mount, call GET /api/auth/validate.
  // If no valid token or role != 'student', redirect to /login.

  // TODO: BACKEND INTEGRATION - Fetch student's past results.
  // GET /api/students/{studentId}/results  with Authorization: Bearer {token}
  // Expected response: Array<{ id, subject, code, rawScore, adjustedScore, date, duration, grade }>
  // Replace the hardcoded `recentResults` array with this response.
  const avgAdjusted = Math.round(
    recentResults.reduce((s, r) => s + r.adjustedScore, 0) /
      recentResults.length,
  );

  return (
    <div className="min-h-screen bg-[#f3eefc] font-sans">
      {/* Top Nav */}
      <nav className="sticky top-0 z-10 flex items-center justify-between border-b border-purple-100/60 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            DynoQuizz
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            S
          </div>
          <button
            type="button"
            onClick={() => {
              // TODO: BACKEND INTEGRATION - Sign out: call POST /api/auth/logout
              // with Authorization: Bearer {token}, then:
              // localStorage.removeItem("dynoquizz_token"); router.push('/login');
            }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        {/* Welcome Header */}
        <section>
          <p className="text-sm font-medium text-blue-600">Student Portal</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Welcome back, Student 👋
          </h1>
          <p className="mt-2 text-slate-500">
            Ready to prove what you know? Join a live assessment or review your
            past results.
          </p>
        </section>

        {/* Stats Row */}
        <section className="grid grid-cols-3 gap-4">
          {[
            {
              icon: <ClipboardList className="h-5 w-5 text-blue-600" />,
              label: "Tests Taken",
              value: recentResults.length,
              bg: "bg-blue-50",
            },
            {
              icon: <TrendingUp className="h-5 w-5 text-emerald-600" />,
              label: "Avg. Adjusted Score",
              value: `${avgAdjusted}%`,
              bg: "bg-emerald-50",
            },
            {
              icon: <Award className="h-5 w-5 text-purple-600" />,
              label: "Best Grade",
              value: "A+",
              bg: "bg-purple-50",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl bg-white p-5 shadow-sm border border-white/80"
            >
              <div className={`mb-3 inline-flex rounded-xl p-2 ${stat.bg}`}>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* Primary CTA — Join Assessment */}
        <section className="rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-violet-600 p-8 shadow-2xl shadow-blue-200/50 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">
                Primary Action
              </p>
              <h2 className="mt-2 text-2xl font-bold">Join an Assessment</h2>
              <p className="mt-2 max-w-xs text-sm text-blue-100">
                Enter your session code to start a live, AI-proctored exam. Make
                sure your camera is ready.
              </p>
              <Link
                href="/join"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-700 shadow-lg transition-all hover:scale-[1.03] hover:shadow-blue-300/60 active:scale-[0.98]"
              >
                <PlayCircle className="h-4 w-4" />
                Join Assessment
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="hidden sm:flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <ShieldCheck className="h-10 w-10 text-white/80" />
            </div>
          </div>
        </section>

        {/* Recent Results */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Results</h2>
            <button
              type="button"
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              View all
            </button>
          </div>

          <div className="rounded-[2.5rem] bg-white shadow-2xl overflow-hidden border border-white/80">
            <ul className="divide-y divide-slate-100">
              {recentResults.map((result) => (
                <li key={result.id}>
                  <Link
                    href={`/dashboard/student/result/${result.code}`}
                    className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {result.subject}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {result.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {result.duration}
                        </span>
                        <span className="font-mono text-slate-400">
                          {result.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      {/* Raw vs Adjusted */}
                      <div className="hidden sm:flex flex-col items-end text-xs">
                        <span className="font-semibold text-slate-700">
                          {result.adjustedScore}%
                        </span>
                        <span className="text-slate-400 line-through">
                          {result.score}%
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          adjusted
                        </span>
                      </div>
                      {/* Grade Badge */}
                      <span
                        className={`inline-flex min-w-[2.5rem] items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${gradeColor(
                          result.grade,
                        )}`}
                      >
                        {result.grade}
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
