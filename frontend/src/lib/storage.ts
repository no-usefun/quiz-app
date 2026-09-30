/**
 * Local storage compatibility layer.
 *
 * Quiz definitions, quiz settings, submissions, scores, and published
 * results are backend-owned data. They must not be persisted as an
 * authoritative local database in:
 *
 *   dynoquizz_tests
 *   dynoquizz_results
 *   dynoquizz_result_<code>
 *
 * The functions below are kept as no-op compatibility exports so any
 * remaining legacy import does not break the frontend build. New code
 * should read/write through the API instead.
 */

import type { QuizTest, StudentTestResult } from "./types";

const TESTS_KEY = "dynoquizz_tests";
const RESULTS_KEY = "dynoquizz_results";
const RESULT_PREFIX = "dynoquizz_result_";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Remove the old client-side quiz/result database.
 *
 * Safe to call during logout or application migration. It does not touch
 * the authenticated token, user profile, or active attempt state.
 */
export function clearLegacyQuizStorage(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(TESTS_KEY);
    localStorage.removeItem(RESULTS_KEY);

    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(RESULT_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Unable to clear legacy quiz storage:", error);
  }
}

/**
 * @deprecated Quiz definitions must come from the teacher API.
 */
export function getStoredTests(): QuizTest[] {
  return [];
}

/**
 * @deprecated Quiz definitions must be created through the teacher API.
 */
export function saveTest(_test: QuizTest): void {
  // Intentionally empty.
}

/**
 * @deprecated Quiz settings must be updated through the teacher API.
 */
export function updateTestSettings(
  _code: string,
  _partialSettings: Partial<QuizTest["settings"]>,
): QuizTest | null {
  return null;
}

/**
 * @deprecated Quiz status is controlled by the backend lifecycle.
 */
export function updateTestStatus(
  _code: string,
  _status: "LIVE" | "ENDED",
): QuizTest | null {
  return null;
}

/**
 * @deprecated Quiz details must be resolved through the teacher API.
 */
export function getTestByCode(_code: string): QuizTest | null {
  return null;
}

/**
 * @deprecated Student submissions/results must come from the student API.
 */
export function getStoredResults(): StudentTestResult[] {
  return [];
}

/**
 * @deprecated Submission results must be read from the backend result APIs.
 */
export function saveResult(_result: StudentTestResult): void {
  // Intentionally empty.
}

/**
 * @deprecated Result lookup must use the backend attempt/result endpoints.
 */
export function getResultByCode(_code: string): StudentTestResult | null {
  return null;
}
