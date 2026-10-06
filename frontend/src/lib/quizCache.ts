// src/lib/quizCache.ts
// The backend has no "list quizzes for teacher" endpoint yet, so we keep
// every quiz returned by POST /api/v1/teacher/quizzes in localStorage.

const keyFor = (teacherId?: string | number | null) =>
  `dynoquizz_quizzes_${teacherId ?? "anon"}`;

export function getCachedQuizzes(teacherId?: string | number | null): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(keyFor(teacherId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheQuiz(
  teacherId: string | number | null | undefined,
  quiz: any,
) {
  if (typeof window === "undefined" || !quiz) return;
  const id = quiz.quizId ?? quiz.id;
  if (id == null) return;
  const list = getCachedQuizzes(teacherId).filter(
    (q) => (q.quizId ?? q.id) !== id,
  );
  list.unshift(quiz); // newest first
  localStorage.setItem(keyFor(teacherId), JSON.stringify(list));
}

export function replaceCache(
  teacherId: string | number | null | undefined,
  quizzes: any[],
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(teacherId), JSON.stringify(quizzes));
}

/**
 * Given a URL param that may be either a numeric quizId (e.g. "42") or an
 * access code (e.g. "482910"), scan every dynoquizz_quizzes_* cache key and
 * return the matching entry's real identifiers.
 *
 * Returns:
 *   quizId   – numeric DB id for endpoints like /teacher/quizzes/{quizId}/…
 *   quizCode – human-readable access code for /quizzes/code/{code}/… endpoints
 *              (falls back to the original urlParam if no match found)
 */
export function resolveQuizIdentifiers(urlParam: string): {
  quizId: string | null;
  quizCode: string;
} {
  if (typeof window === "undefined") {
    return { quizId: null, quizCode: urlParam };
  }
  try {
    const allKeys = Object.keys(localStorage).filter(
      (k) => k.startsWith("dynoquizz_quizzes_") || k === "dynoquizz_teacher_quizzes",
    );
    for (const key of allKeys) {
      const list: any[] = JSON.parse(localStorage.getItem(key) || "[]");
      const found = list.find(
        (q) =>
          String(q.quizId ?? q.id) === String(urlParam) ||
          String(q.quizCode ?? q.testCode ?? "") === String(urlParam),
      );
      if (found) {
        const quizId = found.quizId ?? found.id ?? null;
        const quizCode = found.quizCode || found.testCode || urlParam;
        return { quizId: quizId != null ? String(quizId) : null, quizCode };
      }
    }
  } catch {
    // Ignore – fall through to the safe default
  }
  const isNumeric = /^\d+$/.test(urlParam);
  return { quizId: isNumeric ? urlParam : null, quizCode: urlParam };
}
