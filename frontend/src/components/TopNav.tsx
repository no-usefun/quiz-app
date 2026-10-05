"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { LogOut, User, LayoutDashboard, PlusCircle } from "lucide-react";
import { AppWordmark } from "@/components/Logo";

interface TopNavbarProps {
  role?: string;
}

export function TopNavbar({ role: propRole }: TopNavbarProps = {}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("dynoquizz_token");
      localStorage.removeItem("dynoquizz_regNo");
      localStorage.removeItem("dynoquizz_role");
      localStorage.removeItem("dynoquizz_user");
      sessionStorage.clear();
      document.cookie =
        "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Ignore network errors on logout
    }
    window.location.href = "/";
  };

  const currentRole = (propRole || user?.role || "").toUpperCase();
  const isTeacher = currentRole === "TEACHER";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#d1dee8]/70 bg-white/90 backdrop-blur-md shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href={isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
            className="flex items-center transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            <AppWordmark size="default" />
          </Link>
        </div>

        <nav className="hidden md:flex items-center space-x-1.5">
          {isTeacher ? (
            <>
              <Link
                href="/dashboard/teacher"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-[10px] text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                  pathname === "/dashboard/teacher"
                    ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                    : "text-[#78716b] hover:text-[#111111] hover:bg-[#f5f5f4]"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/dashboard/teacher/create"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-[10px] text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                  pathname === "/dashboard/teacher/create"
                    ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                    : "text-[#78716b] hover:text-[#111111] hover:bg-[#f5f5f4]"
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Quiz</span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard/student"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-[10px] text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                pathname === "/dashboard/student"
                  ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                  : "text-[#78716b] hover:text-[#111111] hover:bg-[#f5f5f4]"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Student Portal</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pl-3 border-l border-[#d1dee8]/70">
            <div className="h-8 w-8 rounded-full bg-[#111111] text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 ring-[#111111]/10">
              {user?.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-[#111111]">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] font-bold text-[#165dfb] uppercase tracking-wider">
                {user?.role || "STUDENT"}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#8c381c] hover:bg-[#fbeee8] rounded-[10px] transition-all duration-150 cursor-pointer border border-[#8c381c]/25 bg-white shadow-xs hover:shadow-sm active:scale-[0.98]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopNavbar as TopNav };


