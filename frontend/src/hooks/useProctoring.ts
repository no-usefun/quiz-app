"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ProctoringFlags = {
  // The backend keeps both raw event types for audit compatibility.
  // The frontend treats tab switching and fullscreen exit as one violation.
  tab_switch: number;
  fullscreen_exit: number;
  right_click: number;
  copy_attempt: number;
  cut_attempt: number;
  paste_attempt: number;
  focus_loss: number;
  keyboard_attempt: number;
  refresh_count: number;
  reconnect_count: number;
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
  refresh_count: 0,
  reconnect_count: 0,
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

export function useProctoring(
  storageKeyValue?: string | null,
  onEvent?: (event: ProctoringEvent) => void | Promise<void>,
) {
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
  const lastTabOrFullscreenExitRef = useRef(0);

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
      const event: ProctoringEvent = {
        type,
        timestamp: Date.now(),
      };

      const nextEvents = [
        ...eventsRef.current.slice(-99),
        event,
      ];

      eventsRef.current = nextEvents;

      setFlags((previous) => {
        const nextFlags = {
          ...previous,
          [type]: previous[type] + 1,
        };

        persist(nextFlags, nextEvents);
        return nextFlags;
      });

      setWarnings((previous) => [...previous.slice(-9), message]);

      try {
        void onEvent?.(event);
      } catch {
        // Proctoring detection must continue if server sync fails.
      }
    },
    [persist, onEvent],
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

    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;

    if (navigation?.type === "reload") {
      record("refresh_count", "Assessment page refresh detected.");
    }

    let wasOffline = !navigator.onLine;

    const onOnline = () => {
      if (wasOffline) {
        record(
          "reconnect_count",
          "Network reconnection detected during the assessment.",
        );
      }
      wasOffline = false;
    };

    const onOffline = () => {
      wasOffline = true;
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [record]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const recordTabOrFullscreenExit = (message: string) => {
      const now = Date.now();

      // Browsers can emit visibilitychange and fullscreenchange for the same
      // user action. Treat that action as one unified proctoring violation.
      if (now - lastTabOrFullscreenExitRef.current < 1000) {
        return;
      }

      lastTabOrFullscreenExitRef.current = now;
      // Use one frontend violation counter/event for both browser signals.
      // This also prevents visibilitychange + fullscreenchange from being
      // counted twice for the same user action.
      record("tab_switch", message);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        recordTabOrFullscreenExit(
          "Tab switch / fullscreen exit activity detected.",
        );
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
        recordTabOrFullscreenExit(
          "Tab switch / fullscreen exit activity detected.",
        );
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
