"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ENDPOINTS } from "@/lib/api/endpoints";

type SessionUser = {
  id?: number;
  userId?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  name?: string;
  email?: string;
  role?: string;
  college?: string;
  department?: string;
  institution?: string;
  program?: string;
  registrationNo?: string;
  phone?: string;
  authProvider?: string;
  profileImage?: string;
  verified?: boolean;
  active?: boolean;
  [key: string]: unknown;
};

type LoginCredentials = {
  email: string;
  password: string;
  role: "STUDENT" | "TEACHER";
};

type SignupPayload = {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  role?: string;
  college?: string;
  department?: string;
  registrationNo?: string;
  phone?: string;
};

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  const primaryToken = localStorage.getItem("dynoquizz_token");
  const legacyToken = localStorage.getItem("token");
  const rawToken = primaryToken || legacyToken;

  if (!rawToken) return null;

  const cleanToken = rawToken.replace(/^["']|["']$/g, "").trim();

  if (!cleanToken || cleanToken === "undefined" || cleanToken === "null") {
    localStorage.removeItem("dynoquizz_token");
    localStorage.removeItem("token");
    return null;
  }

  if (!primaryToken || primaryToken !== cleanToken) {
    localStorage.setItem("dynoquizz_token", cleanToken);
  }

  if (legacyToken) {
    localStorage.removeItem("token");
  }

  return cleanToken;
}

function normalizeUser(data: SessionUser): SessionUser {
  const fullName =
    data.fullName ||
    `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
    data.name ||
    "";

  const role = data.role ? String(data.role).toUpperCase() : undefined;

  return {
    ...data,
    id: data.id ?? data.userId,
    role,
    name: fullName,
    institution: data.college ?? data.institution ?? "",
    program: data.department ?? data.program ?? "",
  };
}

function saveSessionUser(user: SessionUser) {
  if (typeof window === "undefined") return;

  localStorage.setItem("dynoquizz_user", JSON.stringify(user));

  if (user.role) {
    localStorage.setItem("dynoquizz_role", String(user.role).toUpperCase());
  }

  if (user.registrationNo) {
    localStorage.setItem(
      "dynoquizz_regNo",
      String(user.registrationNo).trim().toUpperCase(),
    );
  } else {
    localStorage.removeItem("dynoquizz_regNo");
  }
}

function clearSessionStorage() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("dynoquizz_token");
  localStorage.removeItem("token");
  localStorage.removeItem("dynoquizz_user");
  localStorage.removeItem("dynoquizz_role");
  localStorage.removeItem("dynoquizz_regNo");
  localStorage.removeItem("dynoquizz_attemptId");

  for (const key of Object.keys(localStorage)) {
    if (
      key.startsWith("dynoquizz_active_test_") ||
      key.startsWith("dynoquizz_attemptId_") ||
      key.startsWith("dynoquizz_attemptTiming_") ||
      key.startsWith("dynoquizz_pkg_")
    ) {
      localStorage.removeItem(key);
    }
  }

  sessionStorage.clear();

  document.cookie =
    "dynoquizz_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;";
}

function persistToken(token: string) {
  if (typeof window === "undefined") return;

  const cleanToken = token.replace(/^["']|["']$/g, "").trim();

  if (!cleanToken || cleanToken === "undefined" || cleanToken === "null") {
    throw new Error("Authentication server returned an invalid token.");
  }

  localStorage.setItem("dynoquizz_token", cleanToken);
  localStorage.removeItem("token");

  document.cookie = `dynoquizz_token=${encodeURIComponent(
    cleanToken,
  )}; path=/; max-age=86400`;
}

export function useSession() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(
    (redirect = true) => {
      clearSessionStorage();
      setUser(null);

      if (
        redirect &&
        typeof window !== "undefined" &&
        window.location.pathname !== "/login"
      ) {
        router.replace("/login");
      }
    },
    [router],
  );

  const fetchSession = useCallback(async (): Promise<SessionUser | null> => {
    const token = getStoredToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("dynoquizz_user");

      if (storedUser) {
        try {
          setUser(normalizeUser(JSON.parse(storedUser)));
        } catch {
          localStorage.removeItem("dynoquizz_user");
        }
      }
    }

    try {
      const response = await fetch(ENDPOINTS.auth.me, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (response.ok) {
        const data: SessionUser = await response.json();
        const normalizedUser = normalizeUser(data);

        if (!normalizedUser.role) {
          throw new Error("Authenticated user has no role.");
        }

        if (normalizedUser.active === false) {
          throw new Error("Your account is disabled.");
        }

        setUser(normalizedUser);
        saveSessionUser(normalizedUser);

        return normalizedUser;
      }

      if (
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403
      ) {
        clearSessionStorage();
        setUser(null);
        return null;
      }

      return null;
    } catch (error) {
      console.warn("Session verification failed:", error);

      /*
       * Keep the cached user when the backend is temporarily unreachable.
       * A rejected authentication response above still clears the session.
       */
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const requestedRole = String(credentials.role).toUpperCase();

    if (requestedRole !== "STUDENT" && requestedRole !== "TEACHER") {
      throw new Error("Role must be STUDENT or TEACHER.");
    }

    const response = await fetch(
      ENDPOINTS.auth.login + "?role=" + encodeURIComponent(requestedRole),
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message =
        data?.message || data?.error || "Invalid email or password.";

      throw new Error(message);
    }

    const token = typeof data?.token === "string" ? data.token : "";

    if (!token) {
      throw new Error(
        "Login succeeded but the authentication token was not returned.",
      );
    }

    persistToken(token);

    /*
     * /auth/login already returns UserSummaryResponse, but /auth/me is
     * the canonical session source and also confirms the token works.
     */
    const meResponse = await fetch(ENDPOINTS.auth.me, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const meData = await meResponse.json().catch(() => ({}));

    if (!meResponse.ok) {
      clearSessionStorage();
      throw new Error(
        meData?.message ||
          meData?.error ||
          "Unable to verify the authenticated session.",
      );
    }

    const normalizedUser = normalizeUser(meData);

    if (!normalizedUser.role) {
      clearSessionStorage();
      throw new Error("Authenticated account has no valid role.");
    }

    if (normalizedUser.active === false) {
      clearSessionStorage();
      throw new Error("Your account is disabled.");
    }

    if (String(normalizedUser.role).toUpperCase() !== requestedRole) {
      clearSessionStorage();
      throw new Error(
        `This account is registered as ${String(
          normalizedUser.role,
        ).toLowerCase()}, not ${requestedRole.toLowerCase()}.`,
      );
    }

    setUser(normalizedUser);
    saveSessionUser(normalizedUser);

    return normalizedUser;
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const backendRole = String(payload.role || "STUDENT").toUpperCase();

    if (backendRole !== "STUDENT" && backendRole !== "TEACHER") {
      throw new Error("Role must be STUDENT or TEACHER.");
    }

    if (backendRole === "STUDENT" && !payload.registrationNo?.trim()) {
      throw new Error("Registration number is required for students.");
    }

    const requestBody = {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName?.trim() || "",
      email: payload.email.trim(),
      password: payload.password,
      ...(payload.college?.trim() ? { college: payload.college.trim() } : {}),
      ...(payload.department?.trim()
        ? { department: payload.department.trim() }
        : {}),
      ...(backendRole === "STUDENT" && payload.registrationNo?.trim()
        ? {
            registrationNo: payload.registrationNo.trim().toUpperCase(),
          }
        : {}),
      ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    };

    const response = await fetch(
      ENDPOINTS.auth.signup + "?role=" + encodeURIComponent(backendRole),
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || "Failed to create account.",
      );
    }

    const returnedUser = data?.user
      ? normalizeUser(data.user)
      : normalizeUser({
          email: payload.email.trim(),
          firstName: payload.firstName.trim(),
          lastName: payload.lastName?.trim() || "",
          role: backendRole,
          registrationNo:
            backendRole === "STUDENT"
              ? payload.registrationNo?.trim().toUpperCase()
              : undefined,
        });

    /*
     * Signup returns SignupResponse, not AuthResponse.
     * It creates the account but does not establish an authenticated session.
     */
    clearSessionStorage();
    setUser(null);

    return {
      user: returnedUser,
      verificationRequired: data?.verificationRequired === true,
      message:
        data?.message || "Account created successfully. You can now log in.",
    };
  }, []);

  return {
    user,
    loading,
    login,
    signup,
    logout,
    refreshSession: fetchSession,
  };
}
