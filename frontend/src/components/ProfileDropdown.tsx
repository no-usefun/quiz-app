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
  const roleName = user.role === "teacher" ? "Educator Account" : "Student Account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fbfbfa] border border-[#d1dee8]/80 text-xs font-bold text-[#111111] cursor-pointer hover:border-[#b9cbd9] hover:bg-white shadow-xs active:scale-95 transition-all duration-150"
        aria-label="User Profile"
      >
        {initial}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 z-50 w-52 rounded-[14px] border border-[#d1dee8]/80 bg-white p-1.5 shadow-lg space-y-0.5"
            >
              <div className="px-3 py-2 border-b border-[#d1dee8]/50 text-left">
                <p className="text-xs font-bold text-[#111111] truncate">{user.name}</p>
                <p className="text-[10px] text-[#78716b] font-medium mt-0.5">{roleName}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-xs font-bold text-[#111111] hover:bg-[#f5f5f4] transition-all duration-150 text-left"
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
                className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-xs font-bold text-[#8c381c] hover:bg-[#fbeee8] transition-all duration-150 cursor-pointer text-left border-0 bg-transparent"
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
