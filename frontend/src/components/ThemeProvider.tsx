"use client";

import { useEffect, type ReactNode } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
} from "next-themes";

/**
 * A previous version followed the operating system and persisted "system".
 * Normalize that legacy preference to light so phone-level dark mode cannot
 * unexpectedly force Quizly into dark mode. An explicit saved "dark" choice
 * is preserved.
 */
function NormalizeLegacyTheme() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");

    if (savedTheme === "system" || theme === "system") {
      setTheme("light");
    }
  }, [setTheme, theme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
    >
      <NormalizeLegacyTheme />
      {children}
    </NextThemesProvider>
  );
}
