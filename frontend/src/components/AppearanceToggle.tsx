"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

type AppearanceToggleProps = {
  /** A compact, icon-first version for shared navigation bars. */
  compact?: boolean;
  className?: string;
};

/**
 * Apple-inspired two-option appearance control using Quizly's blue accent
 * and neutral surfaces. Theme changes apply immediately and persist through
 * next-themes/localStorage.
 */
export function AppearanceToggle({
  compact = false,
  className = "",
}: AppearanceToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render Light as selected before hydration to avoid a theme flash.
  const activeTheme = mounted && theme === "dark" ? "dark" : "light";

  const baseButton =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dfb] focus-visible:ring-offset-1 sm:min-w-0 sm:px-3";
  const activeButton =
    "bg-white text-[#111111] shadow-sm ring-1 ring-black/5 dark:bg-[#394356] dark:text-[#f3f4f6] dark:ring-white/10";
  const idleButton =
    "bg-transparent text-[#78716b] hover:bg-white/65 hover:text-[#111111] dark:text-[#a7b0c0] dark:hover:bg-white/5 dark:hover:text-white";

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#d1dee8]/80 bg-[#eceef2] p-1 shadow-xs dark:border-[#3a4659] dark:bg-[#202938] ${className}`}
    >
      <button
        type="button"
        aria-label="Use light appearance"
        aria-pressed={activeTheme === "light"}
        title="Light appearance"
        onClick={() => setTheme("light")}
        className={`${baseButton} ${activeTheme === "light" ? activeButton : idleButton}`}
      >
        <Sun
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 ${activeTheme === "light" ? "text-[#165dfb] dark:text-[#8eaeff]" : ""}`}
        />
        <span className={compact ? "hidden sm:inline" : "inline"}>Light</span>
      </button>

      <button
        type="button"
        aria-label="Use dark appearance"
        aria-pressed={activeTheme === "dark"}
        title="Dark appearance"
        onClick={() => setTheme("dark")}
        className={`${baseButton} ${activeTheme === "dark" ? activeButton : idleButton}`}
      >
        <Moon
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 ${activeTheme === "dark" ? "text-[#165dfb] dark:text-[#8eaeff]" : ""}`}
        />
        <span className={compact ? "hidden sm:inline" : "inline"}>Dark</span>
      </button>
    </div>
  );
}
