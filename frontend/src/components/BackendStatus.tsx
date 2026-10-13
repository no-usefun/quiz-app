"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { isLanExamMode } from "@/lib/examMode";

type HealthState = "checking" | "ready" | "offline";

interface HealthResponse {
  status?: string;
}

export default function BackendStatus() {
  const [status, setStatus] = useState<HealthState>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = useCallback(async () => {
    const startedAt = performance.now();

    try {
      setStatus("checking");

      const data = await api.get<HealthResponse>(ENDPOINTS.system.health, {
        skipAuth: true,
        retry: 1,
        retryDelayMs: 250,
        cache: "no-store",
      });

      const elapsed = Math.round(performance.now() - startedAt);

      if (data.status === "UP") {
        setStatus("ready");
        setLatency(elapsed);
      } else {
        setStatus("offline");
        setLatency(null);
      }
    } catch {
      setStatus("offline");
      setLatency(null);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    const interval = window.setInterval(checkHealth, isLanExamMode() ? 10_000 : 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkHealth();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkHealth]);

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        CONNECTING
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        {isLanExamMode() ? "LOCAL / READY" : "Backend: Ready"}
        {latency !== null && (
          <span className="text-gray-500">({latency}ms)</span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={checkHealth}
      className="flex items-center gap-2 text-xs text-red-600 transition-opacity hover:opacity-80"
      title="Click to check again"
    >
      <span className="h-2 w-2 rounded-full bg-red-500" />
      BACKEND UNAVAILABLE
    </button>
  );
}
