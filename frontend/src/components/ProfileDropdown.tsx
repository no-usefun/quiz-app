"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";
import { useSession } from "@/hooks/useSession";

type ProfileDropdownProps = {
  dashboardHref?: string;
};

export function ProfileDropdown({ dashboardHref }: ProfileDropdownProps = {}) {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const displayName =
    user.fullName ||
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "User";
  const isTeacher = String(user.role || "").toUpperCase() === "TEACHER";
  const dashboardPath =
    dashboardHref || (isTeacher ? "/dashboard/teacher" : "/dashboard/student");
  const roleName = isTeacher ? "Educator Account" : "Student Account";
  const initial = displayName.charAt(0).toUpperCase() || "U";

  const menuItem =
    "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-xs font-semibold text-[#111111] transition-colors duration-150 hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] dark:text-[#f3f4f6] dark:hover:bg-[#293446]";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-10 w-10 items-center justify-center rounded-full p-1 transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] focus-visible:ring-offset-2 active:scale-95"
        aria-label="User profile menu"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111111] text-xs font-bold text-white shadow-xs ring-2 ring-[#111111]/10">
          {initial}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <button
              type="button"
              aria-label="Close profile menu"
              className="fixed inset-0 z-40 cursor-default"
              onClick={() => setOpen(false)}
            />

            <motion.div
              role="menu"
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-56 space-y-0.5 rounded-[14px] border border-[#d1dee8]/80 bg-white p-1.5 shadow-lg dark:border-[#3a4659] dark:bg-[#1b2432]"
            >
              <div className="border-b border-[#d1dee8]/50 px-3 py-2 text-left dark:border-[#3a4659]">
                <p className="truncate text-xs font-bold text-[#111111] dark:text-[#f3f4f6]">
                  {displayName}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-[#78716b] dark:text-[#a7b0c0]">
                  {roleName}
                </p>
              </div>

              <Link
                role="menuitem"
                href={dashboardPath}
                onClick={() => setOpen(false)}
                className={menuItem}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f0ff] text-[#165dfb] dark:bg-[#253755] dark:text-[#8eaeff]">
                  <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
                </span>
                Dashboard
              </Link>

              <Link
                role="menuitem"
                href="/settings"
                onClick={() => setOpen(false)}
                className={menuItem}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#f0f0f0] text-[#5e5e63] dark:bg-[#303c4f] dark:text-[#e5e7eb]">
                  <Settings aria-hidden="true" className="h-4 w-4" />
                </span>
                Settings
              </Link>

              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left text-xs font-semibold text-[#c43d3d] transition-colors duration-150 hover:bg-[#fff0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] dark:text-[#ff9b9b] dark:hover:bg-[#3a252b]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#fff0f0] text-[#c43d3d] dark:bg-[#3a252b] dark:text-[#ff9b9b]">
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                </span>
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
