"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { AppleSwitch } from "@/components/AppleSwitch";

type AppearanceToggleProps = {
  className?: string;
};

/** Settings-specific adapter for the shared Apple-style switch. */
export function AppearanceToggle({ className = "" }: AppearanceToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render the Light state until the saved preference has been hydrated.
  const isDark = mounted && theme === "dark";

  return (
    <AppleSwitch
      checked={isDark}
      onChange={(checked) => setTheme(checked ? "dark" : "light")}
      ariaLabel="Dark mode"
      className={className}
    />
  );
}
