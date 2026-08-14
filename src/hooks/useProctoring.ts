"use client";

import { useState, useEffect } from "react";

export function useProctoring() {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [violationCount, setViolationCount] = useState(0);
  const [flags, setFlags] = useState({
    tab_switch: 0,
    fullscreen_exit: 0,
    right_click: 0,
    copy_attempt: 0,
  });

  const addWarning = (type: keyof typeof flags, message: string) => {
    setWarnings((prev) => [message, ...prev]);
    setViolationCount((prev) => prev + 1);
    setFlags((prev) => ({
      ...prev,
      [type]: prev[type] + 1,
    }));
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addWarning("tab_switch", "Tab switched or window minimized");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addWarning("fullscreen_exit", "Exited fullscreen mode");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addWarning("right_click", "Right-click is disabled");
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addWarning("copy_attempt", "Copying text is disabled");
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addWarning("copy_attempt", "Pasting text is disabled");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        console.log("Fullscreen request failed");
      });
    }
  };

  return { warnings, violationCount, flags, requestFullscreen };
}
