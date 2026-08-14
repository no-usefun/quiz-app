"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Users,
  BarChart3,
  LogOut,
  Settings,
  Copy,
} from "lucide-react";

export default function TeacherDashboard() {
  // TODO: BACKEND INTEGRATION - Auth guard: on mount, call GET /api/auth/validate.
  // If no valid token or role != 'teacher', redirect to /login.
  // Token is stored in localStorage under key "dynoquizz_token".

  // TODO: BACKEND INTEGRATION - Fetch teacher's assessment list.
  // GET /api/assessments?teacherId={id}&Authorization=Bearer {token}
  // Expected response: Array<{ id, title, subjectCode, status: 'LIVE'|'ENDED', participantCount, createdAt }>
  // Replace the hardcoded CS-101, CS-302, CS-401 cards with this data.
  return (
    <main className="min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-[2.5rem] bg-white shadow-2xl relative overflow-hidden border border-white/50">
        <header className="flex w-full items-center justify-between border-b border-slate-100 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              DynoQuizz
            </span>
          </div>
          <Link
            href="/"
            onClick={() => {
              // TODO: BACKEND INTEGRATION - Sign out: call POST /api/auth/logout
              // with Authorization: Bearer {token}, then remove token:
              // localStorage.removeItem("dynoquizz_token")
            }}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </Link>
        </header>

        <div className="flex flex-1 flex-col p-8 md:p-12 lg:flex-row gap-12">
          <div className="flex-1 lg:max-w-xs">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
              Dashboard
            </h1>
            <p className="text-slate-500 mb-10">
              Manage assessments and monitor live telemetry.
            </p>

            <Link
              href="/dashboard/teacher/create"
              className="group flex w-full items-center gap-3 rounded-full bg-black px-6 py-4 text-sm font-bold text-white transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/10 mb-4"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Plus className="h-5 w-5" />
              </div>
              Create Assessment
            </Link>

            <Link
              href="/settings"
              className="flex w-full items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
            >
              <Settings className="h-5 w-5 text-slate-400" />
              Global Settings
            </Link>
          </div>

          <div className="flex-1">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">
                Active & Past Assessments
              </h3>
              <div className="flex gap-2">
                <select className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 outline-none">
                  <option>All Time</option>
                  <option>This Week</option>
                  <option>This Month</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-6 transition-all hover:border-slate-200 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-4 sm:mb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold tracking-wider text-blue-700">
                      LIVE
                    </span>
                    <h4 className="font-bold text-slate-900 text-lg">
                      CS-101 Midterm
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> 42/50 Joined
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-slate-900">
                      <Copy className="h-4 w-4" /> Code: CS-101
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/teacher/live/CS-101"
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] shadow-md shadow-blue-200"
                  >
                    <BarChart3 className="h-4 w-4" /> Leaderboard
                  </Link>
                </div>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-4 sm:mb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-wider text-slate-600">
                      ENDED
                    </span>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Database Systems Quiz
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> 120 Completed
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/teacher/assessment/CS-302"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                  >
                    View Results
                  </Link>
                </div>
              </div>

              <div className="flex flex-col rounded-2xl border border-slate-100 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="mb-4 sm:mb-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-wider text-slate-600">
                      ENDED
                    </span>
                    <h4 className="font-bold text-slate-900 text-lg">
                      Algorithms Mock Test
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" /> 85 Completed
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/dashboard/teacher/assessment/CS-401"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                  >
                    View Results
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
