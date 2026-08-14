"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionUser {
  userId: string;
  email: string;
  role: "student" | "teacher";
  name: string;
}

export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      // Explicit logout goes back to landing page
      router.push("/");
      router.refresh();
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return { user, loading, logout, refreshSession: fetchSession };
}
