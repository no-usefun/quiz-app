"use client";

import { useState, useEffect } from "react";

export function useProctoring() {
  const [warnings] = useState<string[]>([]);
  const [violationCount] = useState(0);
  const [flags] = useState({
    tab_switch: 0,
    fullscreen_exit: 0,
    right_click: 0,
    copy_attempt: 0,
  });

  const requestFullscreen = () => {
    // Non-blocking no-op / optional
  };

  return { warnings, violationCount, flags, requestFullscreen };
}
