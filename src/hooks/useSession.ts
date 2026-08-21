"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = () => {
    try {
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("dynoquizz_user") : null;
      const token = typeof window !== "undefined" ? localStorage.getItem("dynoquizz_token") : null;
      const role = typeof window !== "undefined" ? localStorage.getItem("dynoquizz_role") : null;

      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);
          setLoading(false);
          return;
        } catch (e) {
          // ignore
        }
      }

      if (token) {
        const defaultRole = (role || "STUDENT").toUpperCase();
        setUser({
          name: defaultRole === "TEACHER" ? "Instructor Account" : "Student Candidate",
          email: defaultRole === "TEACHER" ? "instructor@quizly.app" : "student@quizly.app",
          role: defaultRole,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (credentials: { email: string; password: string; role?: string }) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const userObj = data.user || {
          email: credentials.email,
          role: (credentials.role || "student").toUpperCase(),
          name: data.user?.name || credentials.email.split("@")[0],
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
          localStorage.setItem("dynoquizz_role", userObj.role);
          if (data.token) {
            localStorage.setItem("dynoquizz_token", data.token);
            document.cookie = `dynoquizz_token=${data.token}; path=/; max-age=86400`;
          }
        }
        setUser(userObj);
        return userObj;
      }
      throw new Error(data.error || "Invalid email or password.");
    } catch (e: any) {
      throw new Error(e.message || "Failed to log in.");
    }
  };

  const signup = async (payload: { name: string; email: string; password: string; role?: string }) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const userObj = data.user || {
          email: payload.email,
          role: (payload.role || "student").toUpperCase(),
          name: payload.name,
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
          localStorage.setItem("dynoquizz_role", userObj.role);
          if (data.token) {
            localStorage.setItem("dynoquizz_token", data.token);
            document.cookie = `dynoquizz_token=${data.token}; path=/; max-age=86400`;
          }
        }
        setUser(userObj);
        return userObj;
      }
      throw new Error(data.error || "Failed to create account.");
    } catch (e: any) {
      throw new Error(e.message || "Failed to sign up.");
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("dynoquizz_token");
      localStorage.removeItem("dynoquizz_user");
      localStorage.removeItem("dynoquizz_role");
      localStorage.removeItem("dynoquizz_regNo");
      sessionStorage.clear();
      document.cookie = "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, login, signup, logout, refreshSession: fetchSession };
}
