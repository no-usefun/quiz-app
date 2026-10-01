"use client";

import { useCallback, useMemo } from "react";

type ProctoringFlags = {
  tab_switch: number;
  fullscreen_exit: number;
  right_click: number;
  copy_attempt: number;
};

export function useProctoring() {
  const warnings = useMemo<string[]>(() => [], []);

  const violationCount = 0;

  const flags = useMemo<ProctoringFlags>(
    () => ({
      tab_switch: 0,
      fullscreen_exit: 0,
      right_click: 0,
      copy_attempt: 0,
    }),
    [],
  );

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") {
      return;
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen is optional and may be denied by the browser.
    }
  }, []);

  return {
    warnings,
    violationCount,
    flags,
    requestFullscreen,
  };
}
