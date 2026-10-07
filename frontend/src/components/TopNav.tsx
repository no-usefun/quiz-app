"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import {
  LogOut,
  User,
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react";
import { AppWordmark } from "@/components/Logo";
import BackendStatus from "@/components/BackendStatus";

interface TopNavbarProps {
  role?: string;
}

export function TopNavbar({ role: propRole }: TopNavbarProps = {}) {
  const { user, logout } = useSession();
  const pathname = usePathname();

  const currentRole = String(propRole || user?.role || "").toUpperCase();
  const isTeacher = currentRole === "TEACHER";

  const displayName =
    user?.fullName ||
    user?.name ||
    `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
    "User";

  const displayRole = currentRole || "STUDENT";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#d1dee8]/70 bg-white/90 shadow-xs backdrop-blur-md">
      {" "}
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {" "}
        <div className="flex items-center space-x-3">
          <Link
            href={isTeacher ? "/dashboard/teacher" : "/dashboard/student"}
            className="flex items-center transition-opacity hover:opacity-90 active:scale-[0.99]"
          >
            {" "}
            <AppWordmark size="default" />{" "}
          </Link>{" "}
        </div>
        <nav className="hidden items-center space-x-1.5 md:flex">
          {isTeacher ? (
            <>
              <Link
                href="/dashboard/teacher"
                className={`flex items-center space-x-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                  pathname === "/dashboard/teacher"
                    ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                    : "text-[#78716b] hover:bg-[#f5f5f4] hover:text-[#111111]"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/dashboard/teacher/create"
                className={`flex items-center space-x-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                  pathname === "/dashboard/teacher/create"
                    ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                    : "text-[#78716b] hover:bg-[#f5f5f4] hover:text-[#111111]"
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Quiz</span>
              </Link>
            </>
          ) : (
            <Link
              href="/dashboard/student"
              className={`flex items-center space-x-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
                pathname === "/dashboard/student"
                  ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                  : "text-[#78716b] hover:bg-[#f5f5f4] hover:text-[#111111]"
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Student Portal</span>
            </Link>
          )}

          <Link
            href="/settings"
            className={`flex items-center space-x-1.5 rounded-[10px] px-3 py-2 text-xs font-bold transition-all duration-150 active:scale-[0.98] ${
              pathname === "/settings"
                ? "bg-[#e8f0ff] text-[#165dfb] shadow-xs"
                : "text-[#78716b] hover:bg-[#f5f5f4] hover:text-[#111111]"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </nav>
        <div className="flex items-center space-x-3">
          <div className="hidden items-center sm:flex">
            <BackendStatus />
          </div>
          <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 border-l border-[#d1dee8]/70 pl-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-xs font-bold text-white shadow-xs ring-2 ring-[#111111]/10">
              {displayName[0]?.toUpperCase() || <User className="h-4 w-4" />}
            </div>

            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-[#111111]">{displayName}</p>

              <p className="text-[10px] font-bold uppercase tracking-wider text-[#165dfb]">
                {displayRole}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => logout()}
            title="Sign out"
            className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-[#8c381c]/25 bg-white px-3 py-1.5 text-xs font-bold text-[#8c381c] shadow-xs transition-all duration-150 hover:bg-[#fbeee8] hover:shadow-sm active:scale-[0.98]"
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
