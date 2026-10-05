"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ENDPOINTS } from "@/lib/api/endpoints";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const rawToken =
        typeof window !== "undefined"
          ? localStorage.getItem("dynoquizz_token") || localStorage.getItem("token")
          : null;
      const storedUser =
        typeof window !== "undefined"
          ? localStorage.getItem("dynoquizz_user")
          : null;

      // 1. Aggressive Token Pre-Validation: Guard against undefined, null, or empty strings
      if (!rawToken || rawToken === "undefined" || rawToken === "null" || rawToken.trim() === "") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("dynoquizz_token");
          localStorage.removeItem("token");
        }
        setUser(null);
        setLoading(false);
        return; // DO NOT FIRE THE FETCH
      }

      // 2. Sanitize the Valid Token: Strip accidental surrounding quotes
      const cleanToken = rawToken.replace(/^["']|["']$/g, "").trim();

      if (!cleanToken || cleanToken === "undefined" || cleanToken === "null") {
        if (typeof window !== "undefined") {
          localStorage.removeItem("dynoquizz_token");
          localStorage.removeItem("token");
        }
        setUser(null);
        setLoading(false);
        return; // DO NOT FIRE THE FETCH
      }

      // 3. Optimistic Load: Instantly load cached user to prevent UI lag
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          // ignore
        }
      }

      // 4. Background Verification: Ping the live backend for fresh data
      const res = await fetch(ENDPOINTS.auth.me, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const liveUserData = await res.json();
        const normalizedUser = {
          ...liveUserData,
          name: liveUserData.fullName || `${liveUserData.firstName || ""} ${liveUserData.lastName || ""}`.trim() || liveUserData.name,
          institution: liveUserData.college || liveUserData.institution || "",
          program: liveUserData.department || liveUserData.program || "",
        };
        setUser(normalizedUser);

        // Keep local cache synced with live database data
        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_user", JSON.stringify(normalizedUser));
          if (liveUserData.role) {
            localStorage.setItem("dynoquizz_role", liveUserData.role.toUpperCase());
          }
          if (liveUserData.registrationNo) {
            localStorage.setItem(
              "dynoquizz_regNo",
              liveUserData.registrationNo,
            );
          }
        }
      } else if (res.status === 401 || res.status === 403 || res.status === 400) {
        // 5. Security: If token is rejected by backend, clear session
        await logout();
      }
    } catch (err) {
      console.warn("Session verification network error. Relying on cache.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (credentials: {
    email: string;
    password: string;
    role?: string;
  }) => {
    try {
      const res = await fetch(ENDPOINTS.auth.login, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email.trim(),
          password: credentials.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const returnedRole = (
          data.user?.role ||
          data.role ||
          credentials.role ||
          "STUDENT"
        ).toUpperCase();
        const userObj = data.user || {
          email: credentials.email,
          role: returnedRole,
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
          localStorage.setItem("dynoquizz_role", returnedRole);
          if (data.token) {
            localStorage.setItem("dynoquizz_token", data.token);
            document.cookie = `dynoquizz_token=${data.token}; path=/; max-age=86400`;
          }
        }
        setUser(userObj);
        return userObj;
      }
      throw new Error(
        data.message || data.error || "Invalid email or password.",
      );
    } catch (e: any) {
      throw new Error(e.message || "Failed to log in.");
    }
  };

  const signup = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role?: string;
    registrationNo?: string;
  }) => {
    try {
      const backendRole = (payload.role || "STUDENT").toUpperCase();

      const res = await fetch(ENDPOINTS.auth.signup, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: payload.firstName.trim(),
          lastName: payload.lastName.trim(),
          email: payload.email.trim(),
          password: payload.password,
          role: backendRole,
          ...(backendRole === "STUDENT" && payload.registrationNo
            ? { registrationNo: payload.registrationNo.trim().toUpperCase() }
            : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const returnedRole = (
          data.user?.role ||
          data.role ||
          backendRole
        ).toUpperCase();
        const userObj = data.user || {
          email: payload.email,
          role: returnedRole,
          name: `${payload.firstName.trim()} ${payload.lastName.trim()}`,
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("dynoquizz_user", JSON.stringify(userObj));
          localStorage.setItem("dynoquizz_role", returnedRole);
          if (data.token) {
            localStorage.setItem("dynoquizz_token", data.token);
            document.cookie = `dynoquizz_token=${data.token}; path=/; max-age=86400`;
          }
        }
        setUser(userObj);
        return userObj;
      }
      throw new Error(
        data.error || data.message || "Failed to create account.",
      );
    } catch (e: any) {
      throw new Error(e.message || "Failed to sign up.");
    }
  };

  const logout = async () => {
    // Optional: If backend adds an invalidation endpoint later, ping it here
    if (typeof window !== "undefined") {
      localStorage.removeItem("dynoquizz_token");
      localStorage.removeItem("dynoquizz_user");
      localStorage.removeItem("dynoquizz_role");
      localStorage.removeItem("dynoquizz_regNo");

      // Clear any active test caches to prevent data leaking between users
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (
          key.startsWith("dynoquizz_active_test_") ||
          key.startsWith("dynoquizz_attemptId_")
        ) {
          localStorage.removeItem(key);
        }
      }

      sessionStorage.clear();
      document.cookie =
        "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
    setUser(null);
    window.location.href = "/login";
  };

  return { user, loading, login, signup, logout, refreshSession: fetchSession };
}
