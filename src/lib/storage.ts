import { QuizTest, StudentTestResult } from "./types";

const TESTS_KEY = "dynoquizz_tests";
const RESULTS_KEY = "dynoquizz_results";

// ─── Storage Utility Functions ────────────────────────────────────────────────

export function getStoredTests(): QuizTest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TESTS_KEY);
    if (!raw) return [];
    const parsed: QuizTest[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error reading dynoquizz_tests from localStorage:", e);
    return [];
  }
}

export function saveTest(test: QuizTest): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredTests();
    const updated = [test, ...current.filter((t) => t.testCode.toUpperCase() !== test.testCode.toUpperCase())];
    localStorage.setItem(TESTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Error saving test to localStorage:", e);
  }
}

export function updateTestSettings(
  code: string,
  partialSettings: Partial<QuizTest["settings"]>
): QuizTest | null {
  if (typeof window === "undefined") return null;
  try {
    const current = getStoredTests();
    let updatedTest: QuizTest | null = null;
    const updatedList = current.map((t) => {
      if (t.testCode.toUpperCase() === code.toUpperCase()) {
        updatedTest = {
          ...t,
          settings: {
            ...t.settings,
            ...partialSettings,
          },
        };
        return updatedTest;
      }
      return t;
    });
    localStorage.setItem(TESTS_KEY, JSON.stringify(updatedList));
    return updatedTest;
  } catch (e) {
    console.error("Error updating test settings in localStorage:", e);
    return null;
  }
}

export function updateTestStatus(
  code: string,
  status: "LIVE" | "ENDED"
): QuizTest | null {
  if (typeof window === "undefined") return null;
  try {
    const current = getStoredTests();
    let updatedTest: QuizTest | null = null;
    const updatedList = current.map((t) => {
      if (t.testCode.toUpperCase() === code.toUpperCase()) {
        updatedTest = {
          ...t,
          status,
        };
        return updatedTest;
      }
      return t;
    });
    localStorage.setItem(TESTS_KEY, JSON.stringify(updatedList));
    return updatedTest;
  } catch (e) {
    console.error("Error updating test status in localStorage:", e);
    return null;
  }
}

export function getTestByCode(code: string): QuizTest | null {
  const tests = getStoredTests();
  const found = tests.find((t) => t.testCode.toUpperCase() === code.toUpperCase());
  return found || null;
}

export function getStoredResults(): StudentTestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) return [];
    const parsed: StudentTestResult[] = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Error reading dynoquizz_results from localStorage:", e);
    return [];
  }
}

export function saveResult(result: StudentTestResult): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredResults();
    const updated = [result, ...current.filter((r) => r.testCode.toUpperCase() !== result.testCode.toUpperCase() || r.studentName !== result.studentName)];
    localStorage.setItem(RESULTS_KEY, JSON.stringify(updated));
    // Also save as latest submission for fast lookup
    localStorage.setItem(`dynoquizz_result_${result.testCode.toUpperCase()}`, JSON.stringify(result));
  } catch (e) {
    console.error("Error saving result to localStorage:", e);
  }
}

export function getResultByCode(code: string): StudentTestResult | null {
  if (typeof window === "undefined") return null;
  try {
    // Check specific latest submission key first
    const specificRaw = localStorage.getItem(`dynoquizz_result_${code.toUpperCase()}`);
    if (specificRaw) return JSON.parse(specificRaw);

    // Fall back to main array
    const results = getStoredResults();
    return results.find((r) => r.testCode.toUpperCase() === code.toUpperCase()) || null;
  } catch (e) {
    console.error("Error finding result in localStorage:", e);
    return null;
  }
}

