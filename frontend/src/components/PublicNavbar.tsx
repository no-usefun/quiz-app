import Link from "next/link";
import { ArrowRight, Home, KeyRound, LayoutDashboard } from "lucide-react";
import { AppWordmark } from "@/components/Logo";

export function PublicNavbar({
  redirectTarget,
  showStudentDashboard = false,
}: {
  redirectTarget?: string;
  showStudentDashboard?: boolean;
} = {}) {
  const authSuffix = redirectTarget ? "?redirect=" + encodeURIComponent(redirectTarget) : "";
  const examHref = redirectTarget?.startsWith("/join") ? redirectTarget : "/join";
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#d1dee8]/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Quizly home" className="shrink-0 transition-opacity hover:opacity-80">
          <AppWordmark size="default" />
        </Link>

        <nav aria-label="Main navigation" className="flex items-center gap-1.5 sm:gap-3">
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#78716b] transition-colors hover:bg-[#f5f5f4] hover:text-[#111111] sm:px-3">
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <Link href={examHref} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[#78716b] transition-colors hover:bg-[#f5f5f4] hover:text-[#111111] sm:px-3">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Join exam</span>
          </Link>
          {showStudentDashboard && (
            <Link
              href="/dashboard/student"
              aria-label="Student Dashboard"
              title="Student Dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-[#165dfb] transition-colors hover:bg-[#eef4ff] sm:px-3"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          )}
          <Link href={"/login" + authSuffix} className="rounded-lg px-2 py-2 text-xs font-semibold text-[#111111] transition-colors hover:bg-[#f5f5f4] sm:px-3">
            Log in
          </Link>
          <Link href={"/signup" + authSuffix} className="inline-flex items-center gap-1.5 rounded-lg bg-[#165dfb] px-2.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#104bd0] sm:px-4">
            Sign up
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
