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
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href={isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
            className="flex items-center"
          >
            <AppWordmark size="default" />
          </Link>
        </div>

        <nav className="hidden md:flex items-center space-x-1">
          {isTeacher ? (
            <>
              <Link
                href="/dashboard/teacher"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/dashboard/teacher"
                    ? "bg-blue-50 text-blue-600"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                href="/dashboard/teacher/create"
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/dashboard/teacher/create"
                    ? "bg-blue-50 text-blue-600"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Quiz</span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard/student"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === "/dashboard/student"
                  ? "bg-blue-50 text-blue-600"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Student Portal</span>
            </Link>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pl-3 border-l border-zinc-200">
            <div className="h-8 w-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-semibold text-xs shadow-sm">
              {user?.name?.[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold text-zinc-900">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] font-medium text-blue-600 uppercase tracking-wider">
                {user?.role || "STUDENT"}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title="Sign out"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer border border-red-200/50 bg-transparent"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export { TopNavbar as TopNav };


