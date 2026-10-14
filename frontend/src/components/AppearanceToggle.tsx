"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

type AppearanceToggleProps = {
  className?: string;
};

/** A macOS-inspired switch with an inset, rounded-rectangle thumb. */
export function AppearanceToggle({ className = "" }: AppearanceToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-label="Dark mode"
      aria-checked={isDark}
      title={isDark ? "Turn off Dark Mode" : "Turn on Dark Mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={"relative inline-flex h-7 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2 " + (isDark ? "bg-[#007aff]" : "bg-[#d1d1d6]") + " " + className}
    >
      <span
        aria-hidden="true"
        className={"pointer-events-none absolute left-[3px] top-[3px] h-[22px] w-[22px] rounded-[7px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.22)] transition-transform duration-200 ease-in-out " + (isDark ? "translate-x-[16px]" : "translate-x-0")}
      />
    </button>
  );
}
