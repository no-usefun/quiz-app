"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, LogOut } from "lucide-react";
import { useSession } from "@/hooks/useSession";

export function ProfileDropdown() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  const roleName =
    String(user.role).toUpperCase() === "TEACHER"
      ? "Educator Account"
      : "Student Account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d1dee8]/80 bg-[#fbfbfa] text-xs font-bold text-[#111111] shadow-xs transition-all duration-150 hover:border-[#b9cbd9] hover:bg-white active:scale-95"
        aria-label="User Profile"
        aria-expanded={open}
      >
        {initial}{" "}
      </button>
      ```
      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 z-50 mt-2 w-52 space-y-0.5 rounded-[14px] border border-[#d1dee8]/80 bg-white p-1.5 shadow-lg"
            >
              <div className="border-b border-[#d1dee8]/50 px-3 py-2 text-left">
                <p className="truncate text-xs font-bold text-[#111111]">
                  {user.name}
                </p>

                <p className="mt-0.5 text-[10px] font-medium text-[#78716b]">
                  {roleName}
                </p>
              </div>

              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-xs font-bold text-[#111111] transition-all duration-150 hover:bg-[#f5f5f4]"
              >
                <Settings className="h-3.5 w-3.5 text-[#78716b]" />
                Settings
              </Link>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left text-xs font-bold text-[#8c381c] transition-all duration-150 hover:bg-[#fbeee8]"
              >
                <LogOut className="h-3.5 w-3.5 text-[#8c381c]" />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
