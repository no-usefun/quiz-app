// src/lib/api/endpoints.ts
export const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export const ENDPOINTS = {
  auth: {
    login: `${API_BASE}/api/v1/auth/login`,
    signup: `${API_BASE}/api/v1/auth/signup`,
    me: `${API_BASE}/api/v1/auth/me`,
  },
  user: {
    profile: `${API_BASE}/api/v1/user/profile`,
  },
  quizzes: {
    packageByCode: (code: string) =>
      `${API_BASE}/api/v1/quizzes/code/${encodeURIComponent(code)}/package`,
    packageById: (id: number | string) =>
      `${API_BASE}/api/v1/quizzes/${id}/package`,
  },
  student: {
    startAttempt: (quizCode: string) =>
      `${API_BASE}/api/v1/student/quizzes/${encodeURIComponent(quizCode)}/attempts`,
    saveAnswer: (attemptId: number | string, questionId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/answers/${questionId}`,
    submitAttempt: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/submit`,
    results: `${API_BASE}/api/v1/student/results`,
    resultByQuizCode: (quizCode: string) =>
      `${API_BASE}/api/v1/student/results/${encodeURIComponent(quizCode)}`,
    attemptResult: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/result`,
    attemptResultDetails: (attemptId: number | string) =>
      `${API_BASE}/api/v1/student/attempts/${attemptId}/result/details`,
    leaderboard: (quizId: number | string) =>
      `${API_BASE}/api/v1/student/quizzes/${quizId}/leaderboard`,
  },
  teacher: {
    quizzes: `${API_BASE}/api/v1/teacher/quizzes`,
    createQuiz: `${API_BASE}/api/v1/teacher/quizzes`,
    publishQuiz: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/publish`,
    completeQuiz: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/complete`,
    publishResults: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/publish`,
    unpublishResults: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/results/unpublish`,
    settings: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/settings`,
    leaderboard: (quizId: number | string) =>
      `${API_BASE}/api/v1/teacher/quizzes/${quizId}/leaderboard`,
  },
};
