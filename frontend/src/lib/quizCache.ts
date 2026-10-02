/**
 * Legacy quiz-cache compatibility layer.
 *
 * The current application uses the Spring Boot backend as the source of
 * truth for quiz definitions, quiz state, publication state, leaderboards,
 * attempts, and results.
 *
 * This module intentionally does NOT persist quiz objects in localStorage.
 * It remains as a compatibility export for older imports until those imports
 * are removed from the codebase.
 */

type QuizLike = Record<string, unknown>;

const LEGACY_PREFIX = "dynoquizz_quizzes_";
const LEGACY_TEACHER_KEY = "dynoquizz_teacher_quizzes";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Removes legacy quiz-cache records created by older frontend versions.
 */
export function clearQuizCache(): void {
  if (!isBrowser()) return;

  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(LEGACY_PREFIX) || key === LEGACY_TEACHER_KEY) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore localStorage failures.
  }
}

/**
 * @deprecated Fetch teacher quizzes from:
 * GET /api/v1/teacher/quizzes
 */
export function getCachedQuizzes(
  _teacherId?: string | number | null,
): QuizLike[] {
  return [];
}

/**
 * @deprecated Quiz creation must be persisted through:
 * POST /api/v1/teacher/quizzes
 */
export function cacheQuiz(
  _teacherId: string | number | null | undefined,
  _quiz: QuizLike,
): void {
  // Intentionally empty: backend is authoritative.
}

/**
 * @deprecated Quiz collections must be refreshed from:
 * GET /api/v1/teacher/quizzes
 */
export function replaceCache(
  _teacherId: string | number | null | undefined,
  _quizzes: QuizLike[],
): void {
  // Intentionally empty: backend is authoritative.
}

/**
 * Resolves a route parameter without trusting local browser cache.
 *
 * Because an access code may itself be numeric, a numeric URL parameter
 * cannot safely be assumed to be a database quizId.
 *
 * Therefore this compatibility helper returns no database id unless a
 * caller explicitly resolves the id through the teacher API.
 */
export function resolveQuizIdentifiers(urlParam: string): {
  quizId: string | null;
  quizCode: string;
} {
  const cleanParam = String(urlParam ?? "").trim();

  if (!cleanParam) {
    return {
      quizId: null,
      quizCode: "",
    };
  }

  return {
    quizId: null,
    quizCode: cleanParam.toUpperCase(),
  };
}
