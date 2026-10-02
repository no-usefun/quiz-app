"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ProctoringFlags = {
  tab_switch: number;
  fullscreen_exit: number;
  right_click: number;
  copy_attempt: number;
  cut_attempt: number;
  paste_attempt: number;
  focus_loss: number;
  keyboard_attempt: number;
};

export type ProctoringEvent = {
  type: keyof ProctoringFlags;
  timestamp: number;
};

const initialFlags: ProctoringFlags = {
  tab_switch: 0,
  fullscreen_exit: 0,
  right_click: 0,
  copy_attempt: 0,
  cut_attempt: 0,
  paste_attempt: 0,
  focus_loss: 0,
  keyboard_attempt: 0,
};

export function useProctoring() {
  const [flags, setFlags] = useState<ProctoringFlags>(initialFlags);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const eventsRef = useRef<ProctoringEvent[]>([]);

  const record = useCallback(
    (type: keyof ProctoringFlags, message: string) => {
      eventsRef.current = [
        ...eventsRef.current.slice(-99),
        { type, timestamp: Date.now() },
      ];

      setFlags((previous) => ({
        ...previous,
        [type]: previous[type] + 1,
      }));

      setWarnings((previous) => [...previous.slice(-9), message]);
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onVisibilityChange = () => {
      if (document.hidden) {
        record("tab_switch", "Tab or browser visibility change detected.");
      }
    };

    const onBlur = () => {
      if (!document.hidden) {
        record("focus_loss", "The assessment window lost focus.");
      }
    };

    const onFullscreenChange = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);

      if (!active) {
        record("fullscreen_exit", "Fullscreen mode was exited.");
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      record("right_click", "Right-click was blocked during the assessment.");
    };

    const onCopy = (event: ClipboardEvent) => {
      event.preventDefault();
      record("copy_attempt", "Copy action was blocked during the assessment.");
    };

    const onCut = (event: ClipboardEvent) => {
      event.preventDefault();
      record("cut_attempt", "Cut action was blocked during the assessment.");
    };

    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      record("paste_attempt", "Paste action was blocked during the assessment.");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const blocked =
        (command && ["c", "x", "v", "a", "p", "s", "u"].includes(key)) ||
        key === "printscreen";

      if (blocked) {
        event.preventDefault();
        record(
          "keyboard_attempt",
          "A restricted keyboard shortcut was blocked.",
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);

    setIsFullscreen(!!document.fullscreenElement);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
    };
  }, [record]);

  const violationCount = useMemo(
    () =>
      Object.values(flags).reduce(
        (sum, count) => sum + Number(count || 0),
        0,
      ),
    [flags],
  );

  const requestFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return false;

    if (document.fullscreenElement) {
      setIsFullscreen(true);
      return true;
    }

    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      return true;
    } catch {
      setIsFullscreen(false);
      return false;
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === "undefined" || !document.fullscreenElement) return;

    try {
      await document.exitFullscreen();
    } catch {
      // Ignore browser fullscreen teardown failures.
    }
  }, []);

  return {
    warnings,
    violationCount,
    flags,
    events: eventsRef.current,
    isFullscreen,
    requestFullscreen,
    exitFullscreen,
  };
}
