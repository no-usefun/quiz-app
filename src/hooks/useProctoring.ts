"use client";

import { useState, useEffect } from "react";

export function useProctoring() {
  const [warnings, setWarnings] = useState<string[]>([]);
  const [violationCount, setViolationCount] = useState(0);

  const addWarning = (message: string) => {
    setWarnings((prev) => [message, ...prev]);
    setViolationCount((prev) => prev + 1);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addWarning("Tab switched or window minimized");
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        addWarning("Exited fullscreen mode");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addWarning("Right-click is disabled");
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addWarning("Copying text is disabled");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
    };
  }, []);

  const requestFullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        console.log("Fullscreen request failed");
      });
    }
  };

  return { warnings, violationCount, requestFullscreen };
}
