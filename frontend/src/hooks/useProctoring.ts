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

type PersistedProctoringState = {
  flags: ProctoringFlags;
  events: ProctoringEvent[];
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

function storageKeyFor(value?: string | null): string | null {
  if (typeof window === "undefined") return null;

  const clean = String(value || "").trim();

  return clean ? `quizly_proctoring_${clean}` : null;
}

function readPersistedState(storageKey: string | null): PersistedProctoringState {
  if (typeof window === "undefined" || !storageKey) {
    return {
      flags: initialFlags,
      events: [],
    };
  }

  try {
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      return {
        flags: initialFlags,
        events: [],
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedProctoringState>;

    const flags: ProctoringFlags = {
      ...initialFlags,
      ...(parsed.flags || {}),
    };

    const events = Array.isArray(parsed.events)
      ? parsed.events
          .filter(
            (event): event is ProctoringEvent =>
              !!event &&
              typeof event.type === "string" &&
              Object.prototype.hasOwnProperty.call(initialFlags, event.type) &&
              Number.isFinite(Number(event.timestamp)),
          )
          .slice(-100)
      : [];

    return { flags, events };
  } catch {
    return {
      flags: initialFlags,
      events: [],
    };
  }
}

export function useProctoring(storageKeyValue?: string | null) {
  const storageKey = storageKeyFor(storageKeyValue);
  const persisted = useMemo(
    () => readPersistedState(storageKey),
    [storageKey],
  );

  const [flags, setFlags] = useState<ProctoringFlags>(persisted.flags);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const eventsRef = useRef<ProctoringEvent[]>(persisted.events);

  const persist = useCallback(
    (nextFlags: ProctoringFlags, nextEvents: ProctoringEvent[]) => {
      if (typeof window === "undefined" || !storageKey) return;

      try {
        const value: PersistedProctoringState = {
          flags: nextFlags,
          events: nextEvents.slice(-100),
        };

        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch {
        // Ignore storage failures; detection must continue in memory.
      }
    },
    [storageKey],
  );

  const record = useCallback(
    (type: keyof ProctoringFlags, message: string) => {
      const nextEvents = [
        ...eventsRef.current.slice(-99),
        { type, timestamp: Date.now() },
      ];

      const nextFlags = {
        ...flags,
        [type]: flags[type] + 1,
      };

      eventsRef.current = nextEvents;
      setFlags(nextFlags);
      setWarnings((previous) => [...previous.slice(-9), message]);
      persist(nextFlags, nextEvents);
    },
    [flags, persist],
  );

  /*
   * Restore the persisted event history when the attempt-specific key is
   * available. This keeps activity counts intact after a page reload.
   */
  useEffect(() => {
    eventsRef.current = persisted.events;
    setFlags(persisted.flags);
  }, [persisted]);

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

    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType === "insertFromPaste") {
        event.preventDefault();
        record(
          "paste_attempt",
          "Paste input was blocked during the assessment.",
        );
      }
    };

    const onDragStart = (event: DragEvent) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const blocked =
        (command && ["c", "x", "v", "a", "p", "s", "u"].includes(key)) ||
        key === "printscreen";

      if (blocked) {
        event.preventDefault();

        const flag =
          key === "c"
            ? "copy_attempt"
            : key === "x"
              ? "cut_attempt"
              : key === "v"
                ? "paste_attempt"
                : "keyboard_attempt";

        record(
          flag,
          key === "c"
            ? "Copy shortcut was blocked during the assessment."
            : key === "x"
              ? "Cut shortcut was blocked during the assessment."
              : key === "v"
                ? "Paste shortcut was blocked during the assessment."
                : "A restricted keyboard shortcut was blocked.",
        );
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("beforeinput", onBeforeInput as EventListener);
    document.addEventListener("dragstart", onDragStart);
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
      document.removeEventListener(
        "beforeinput",
        onBeforeInput as EventListener,
      );
      document.removeEventListener("dragstart", onDragStart);
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
