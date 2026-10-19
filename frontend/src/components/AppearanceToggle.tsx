"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { AppleSwitch } from "@/components/AppleSwitch";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

type AppearanceToggleProps = {
  className?: string;
};

/** Settings-specific adapter for the shared Apple-style switch. */
export function AppearanceToggle({ className = "" }: AppearanceToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

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
