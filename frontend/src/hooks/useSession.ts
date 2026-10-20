"use client";

import { useCallback, useEffect, useState } from "react";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { api } from "@/lib/api/client";

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
  profileComplete?: boolean;
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
    "dynoquizz_token=; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; samesite=lax";
}

function persistToken(token: string, expiresIn?: unknown) {
  if (typeof window === "undefined") return;

  const cleanToken = token.replace(/^["']|["']$/g, "").trim();

  if (!cleanToken || cleanToken === "undefined" || cleanToken === "null") {
    throw new Error("Authentication server returned an invalid token.");
  }

  localStorage.setItem("dynoquizz_token", cleanToken);
  localStorage.removeItem("token");

  const expiresInMs = Number(expiresIn);
  const maxAgeSeconds =
    Number.isFinite(expiresInMs) && expiresInMs > 0
      ? Math.max(1, Math.floor(expiresInMs / 1000))
      : 86400;

  document.cookie = `dynoquizz_token=${encodeURIComponent(
    cleanToken,
  )}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
}

export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(
    (redirect = true) => {
      clearSessionStorage();
      setUser(null);

      // Use a full navigation so stale dashboard/profile UI and route guards
      // cannot survive after the client-side session has been cleared.
      if (redirect && typeof window !== "undefined") {
        window.location.replace("/");
      }
    },
    [],
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
      const data = await api.get<SessionUser>(ENDPOINTS.auth.me, {
        token,
        retry: 1,
        cache: "no-store",
      });

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
    } catch (error) {
      /*
       * A network-level failure means the backend could not be reached at
       * all. Keep the cached user and avoid flooding the browser console.
       * HTTP authentication failures are handled above from the response.
       */
      if (!(error instanceof TypeError && /fetch|network/i.test(error.message))) {
        console.warn("Session verification failed:", error);
      }

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The session request synchronizes the client session with the auth provider.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async session initialization
    void fetchSession();
  }, [fetchSession]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const requestedRole = String(credentials.role).toUpperCase() as "STUDENT" | "TEACHER";

    if (requestedRole !== "STUDENT" && requestedRole !== "TEACHER") {
      throw new Error("Role must be STUDENT or TEACHER.");
    }

    const data = await api.post<Record<string, unknown>>(
      ENDPOINTS.auth.login,
      {
        email: credentials.email.trim(),
        password: credentials.password,
      },
      { skipAuth: true, cache: "no-store" },
    );

    const token = typeof data?.token === "string" ? data.token : "";

    if (!token) {
      throw new Error(
        "Login succeeded but the authentication token was not returned.",
      );
    }

    persistToken(token, data?.expiresIn);

    /*
     * /auth/login already returns UserSummaryResponse, but /auth/me is
     * the canonical session source and also confirms the token works.
     */
    let meData: SessionUser;
    try {
      meData = await api.get<SessionUser>(ENDPOINTS.auth.me, {
        token,
        retry: 1,
        cache: "no-store",
      });
    } catch (error) {
      clearSessionStorage();
      throw error instanceof Error
        ? error
        : new Error("Unable to verify the authenticated session.");
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
    const backendRole = String(payload.role || "STUDENT").toUpperCase() as "STUDENT" | "TEACHER";

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

    const data = await api.post<Record<string, any>>(
      ENDPOINTS.auth.signup(backendRole),
      requestBody,
      { skipAuth: true, cache: "no-store" },
    );

    const returnedUserData = data.user;
    const returnedUser =
      returnedUserData &&
      typeof returnedUserData === "object" &&
      !Array.isArray(returnedUserData)
        ? normalizeUser(returnedUserData as SessionUser)
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
      verificationRequired: data.verificationRequired === true,
      message:
        typeof data.message === "string"
          ? data.message
          : "Account created successfully. You can now log in.",
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
