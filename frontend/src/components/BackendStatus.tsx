"use client";

import { useCallback, useEffect, useState } from "react";

type HealthState = "checking" | "online" | "offline";

interface HealthResponse {
  status?: string;
  responseTimeMs?: number;
  backendStatus?: number;
  error?: string;
}

export default function BackendStatus() {
  const [status, setStatus] = useState<HealthState>("checking");
  const [latency, setLatency] = useState<number | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      setStatus((current) => (current === "offline" ? "checking" : current));

      const response = await fetch("/api/health", {
        method: "GET",
        cache: "no-store",
      });

      const data: HealthResponse = await response.json();

      if (response.ok && data.status === "UP") {
        setStatus("online");
        setLatency(data.responseTimeMs ?? null);
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

    // Check every 60 seconds.
    const interval = window.setInterval(checkHealth, 60_000);

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
        Backend: Checking...
      </div>
    );
  }

  if (status === "online") {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600">
        <span className="h-2 w-2 rounded-full bg-green-500" />
        Backend: Online
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
      Backend: Offline
    </button>
  );
}
