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
        className="flex h-8 w-8 items-center justify-center rounded-full bg-frost-surface border border-mist-blue text-xs font-bold text-midnight-navy cursor-pointer hover:bg-frost-surface/80 transition-colors"
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
              className="absolute right-0 mt-2 z-50 w-48 rounded-cards border border-mist-blue bg-paper-white p-1.5 shadow-xl space-y-0.5"
            >
              <div className="px-2.5 py-2 border-b border-mist-blue/30 text-left">
                <p className="text-xs font-bold text-midnight-navy">{user.name}</p>
                <p className="text-[10px] text-steel-blue-gray font-medium">{roleName}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-inputs px-2.5 py-1.5 text-xs font-bold text-midnight-navy hover:bg-frost-surface transition-colors text-left"
              >
                <Settings className="h-3.5 w-3.5 text-steel-blue-gray" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-inputs px-2.5 py-1.5 text-xs font-bold text-pastel-pink-text hover:bg-pastel-pink/20 transition-colors cursor-pointer text-left border-0 bg-transparent"
              >
                <LogOut className="h-3.5 w-3.5 text-pastel-pink-text" />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
