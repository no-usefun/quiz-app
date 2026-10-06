/**
 * Frontend API endpoint map.
 *
 * Spring Boot is the source of truth for authentication, quiz state,
 * attempts, scoring, results, and permissions.
 */

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export const ENDPOINTS = {
  system: {
    health: `${API_BASE}/api/v1/health`,
  },
  auth: {
    login: `${API_BASE}/api/v1/auth/login`,
    signup: (role: "STUDENT" | "TEACHER") =>
      `${API_BASE}/api/v1/auth/signup?role=${encodeURIComponent(role)}`,
    me: `${API_BASE}/api/v1/auth/me`,
    verifyEmail: `${API_BASE}/api/v1/auth/verify-email`,
    resendVerification: `${API_BASE}/api/v1/auth/resend-verification`,
    changePassword: `${API_BASE}/api/v1/auth/change-password`,
    deleteAccount: `${API_BASE}/api/v1/auth/delete-account`,
    setPassword: `${API_BASE}/api/v1/auth/set-password`,
    forgotPassword: `${API_BASE}/api/v1/auth/forgot-password`,
    resetPassword: `${API_BASE}/api/v1/auth/reset-password`,
    googleLogin: `${API_BASE}/oauth2/authorization/google`,
  },

  // Compatibility aliases for profile/account endpoints.
  user: {
    profile: `${API_BASE}/api/v1/auth/me`,
    notificationPreferences: `${API_BASE}/api/v1/auth/me/notification-preferences`,
  },

  student: {
    startAttempt: (quizCode: string) =>
      `${API_BASE}/api/v1/student/quizzes/${encodeURIComponent(
        quizCode,
      )}/attempts`,

    submitAttempt: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/submit`,

    attemptState: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/state`,

    submissions: `${API_BASE}/api/v1/student/submissions`,

    attemptResult: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/result`,

    attemptResultDetails: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/result/details`,

    availability: (quizCode: string) =>
      `${API_BASE}/api/v1/student/quizzes/${encodeURIComponent(
        quizCode,
      )}/availability`,

    quizPackageByCode: (quizCode: string) =>
      `${API_BASE}/api/v1/student/quizzes/code/${encodeURIComponent(
        quizCode,
      )}/package`,

    quizPackageById: (quizId: number | string) =>
      `${API_BASE}/api/v1/student/quizzes/${quizId}/package`,

    leaderboard: (quizId: number | string) =>
      `${API_BASE}/api/v1/student/quizzes/${quizId}/leaderboard`,

    proctoringEvents: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/proctoring/events`,

    autoSubmitAttempt: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/auto-submit`,
  },

  teacher: {
    quizzes: `${API_BASE}/api/v1/teacher/quizzes`,

    createQuiz: `${API_BASE}/api/v1/teacher/quizzes`,

    quizDetail: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}`,

    settings: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/settings`,

    publishQuiz: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/publish`,

    completeQuiz: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/complete`,

    publishResults: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/publish`,

    unpublishResults: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/unpublish`,

    leaderboard: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/leaderboard`,

  },
} as const;
