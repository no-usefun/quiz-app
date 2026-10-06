"use client";

import { AlertTriangle, CheckCircle2, ClipboardCheck } from "lucide-react";

type LanExamPreflightProps = {
  quiz: {
    quizCode: string;
    status: string;
    totalStudents: number;
    totalQuestions: number;
    allowedRegistrationNumbers?: string[] | null;
  };
};

export default function LanExamPreflight({ quiz }: LanExamPreflightProps) {
  const openToAll = Number(quiz.totalStudents) === 0;

  const checks = [
    {
      label: "Quiz available",
      ok: Boolean(quiz.quizCode),
      detail: quiz.quizCode || "Quiz code missing",
    },
    {
      label: "Questions available",
      ok: Number(quiz.totalQuestions) > 0,
      detail:
        Number(quiz.totalQuestions) > 0
          ? `${quiz.totalQuestions} questions configured`
          : "No questions configured",
    },
    {
      label: "Students available",
      ok: openToAll || Number(quiz.totalStudents) > 0,
      detail: openToAll
        ? "Open to eligible students"
        : `${quiz.totalStudents} target student${quiz.totalStudents === 1 ? "" : "s"} configured`,
    },
    {
      label: "Allowed-student list",
      ok:
        openToAll ||
        (Array.isArray(quiz.allowedRegistrationNumbers) &&
          quiz.allowedRegistrationNumbers.length > 0),
      detail: openToAll
        ? "Not required for an open assessment"
        : Array.isArray(quiz.allowedRegistrationNumbers)
          ? `${quiz.allowedRegistrationNumbers.length} registration number${quiz.allowedRegistrationNumbers.length === 1 ? "" : "s"} returned`
          : "Roster data was not returned",
    },
    {
      label: "Quiz published",
      ok: String(quiz.status).toUpperCase() === "PUBLISHED",
      detail:
        String(quiz.status).toUpperCase() === "PUBLISHED"
          ? "Published"
          : `Current state: ${quiz.status || "UNKNOWN"}`,
    },
  ];

  const passed = checks.filter((check) => check.ok).length;
  const allPassed = passed === checks.length;

  return (
    <section className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#eef4ff] text-[#165dfb] ring-1 ring-[#165dfb]/10">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#78716b]">
              LAN Exam Preflight
            </p>
            <h2 className="mt-0.5 text-sm font-extrabold text-[#111111]">
              {allPassed ? "Frontend checks passed" : "Preflight needs attention"}
            </h2>
            <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-[#78716b]">
              {passed}/{checks.length} checks passed. Spring Boot remains
              authoritative for eligibility and exam lifecycle.
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
            allPassed
              ? "bg-[#e2ede8] text-[#1d5237]"
              : "bg-[#f6efe1] text-[#73561a]"
          }`}
        >
          {allPassed ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {allPassed ? "CHECKS PASSED" : "CHECK REQUIRED"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {checks.map((check) => (
          <div
            key={check.label}
            className={`rounded-[10px] border p-3 ${
              check.ok
                ? "border-[#1d5237]/15 bg-[#f8fbf9]"
                : "border-[#73561a]/15 bg-[#fffaf2]"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {check.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-[#73561a]" />
              )}
              <span className="text-[10px] font-bold text-[#111111]">
                {check.label}
              </span>
            </div>
            <p className="mt-1 text-[9px] font-medium leading-relaxed text-[#78716b]">
              {check.detail}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[9px] font-medium leading-relaxed text-[#78716b]">
        This is a frontend preflight only. The current backend contract does
        not expose a LAN "Prepare" or "Mark READY" endpoint, so no fake server
        readiness state is created.
      </p>
    </section>
  );
}
