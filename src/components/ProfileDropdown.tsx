"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, LogOut } from "lucide-react";

interface ProfileDropdownProps {
  initial?: string;
  roleName?: string;
  userName?: string;
}

export function ProfileDropdown({
  initial = "S",
  roleName = "Student Account",
  userName = "Suryanshu Saini",
}: ProfileDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSignOut = () => {
    localStorage.removeItem("dynoquizz_token");
    router.push("/login");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors"
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
              className="absolute right-0 mt-2 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm space-y-0.5"
            >
              <div className="px-2.5 py-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-905">{userName}</p>
                <p className="text-[10px] text-slate-400 font-medium">{roleName}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-605 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
