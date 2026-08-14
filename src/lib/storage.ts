import { QuizTest, StudentTestResult } from "./types";

const TESTS_KEY = "dynoquizz_tests";
const RESULTS_KEY = "dynoquizz_results";

// ─── Default Seed Tests ───────────────────────────────────────────────────────
export const SEED_TESTS: QuizTest[] = [
  {
    testCode: "CS-101",
    quizName: "CS-101 Midterm Assessment",
    targetClass: "CS-101 Section A",
    totalTimeLimitMinutes: 60,
    passingMarks: 40,
    settings: {
      negativeMarking: true,
      automatedAiPenalty: true,
      publishScoresImmediately: true,
      revealSolutions: true,
      showIntegrityFlagsToStudent: false,
    },
    createdAt: "Aug 10, 2026",
    status: "LIVE",
    questions: [
      {
        id: 1,
        text: "Which data structure operates on a Last In, First Out (LIFO) principle?",
        options: ["Queue", "Stack", "Linked List", "Binary Tree"],
        correctOption: "Stack",
      },
      {
        id: 2,
        text: "What is the worst-case time complexity of searching in a balanced Binary Search Tree?",
        options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
        correctOption: "O(log n)",
      },
      {
        id: 3,
        text: "Which memory region stores dynamically allocated memory in C/C++?",
        options: ["Stack", "Heap", "Data Segment", "Code Segment"],
        correctOption: "Heap",
      },
      {
        id: 4,
        text: "Which graph algorithm finds the single-source shortest path for non-negative edge weights?",
        options: ["Kruskal", "Dijkstra", "Floyd-Warshall", "Prim"],
        correctOption: "Dijkstra",
      },
    ],
  },
  {
    testCode: "CS-302",
    quizName: "Database Systems Quiz",
    targetClass: "CS-302 Section B",
    totalTimeLimitMinutes: 45,
    passingMarks: 40,
    settings: {
      negativeMarking: false,
      automatedAiPenalty: true,
      publishScoresImmediately: false,
      revealSolutions: false,
      showIntegrityFlagsToStudent: false,
    },
    createdAt: "Jul 22, 2026",
    status: "ENDED",
    questions: [
      {
        id: 1,
        text: "Which SQL command is used to remove a table and its structure from a database?",
        options: ["DELETE", "TRUNCATE", "DROP", "REMOVE"],
        correctOption: "DROP",
      },
      {
        id: 2,
        text: "What property guarantees that a transaction executes completely or not at all?",
        options: ["Atomicity", "Consistency", "Isolation", "Durability"],
        correctOption: "Atomicity",
      },
    ],
  },
];

// ─── Default Seed Results ─────────────────────────────────────────────────────
export const SEED_RESULTS: StudentTestResult[] = [
  {
    testCode: "CS-201",
    quizName: "Data Structures & Algorithms",
    targetClass: "CS-201",
    studentName: "Student User",
    submittedAt: "Jul 28, 2026",
    rawScore: 88,
    adjustedScore: 83,
    totalQuestions: 10,
    correctCount: 8,
    grade: "A",
    timeTakenTotalSeconds: 320,
    answers: [],
    flags: [
      { type: "tab_switch", label: "Tab switched", count: 2 },
      { type: "right_click", label: "Right-click attempted", count: 1 },
    ],
  },
];

// ─── Storage Utility Functions ────────────────────────────────────────────────

export function getStoredTests(): QuizTest[] {
  if (typeof window === "undefined") return SEED_TESTS;
  try {
    const raw = localStorage.getItem(TESTS_KEY);
    if (!raw) {
      localStorage.setItem(TESTS_KEY, JSON.stringify(SEED_TESTS));
      return SEED_TESTS;
    }
    const parsed: QuizTest[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_TESTS;
  } catch (e) {
    console.error("Error reading dynoquizz_tests from localStorage:", e);
    return SEED_TESTS;
  }
}

export function saveTest(test: QuizTest): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredTests();
    const updated = [test, ...current.filter((t) => t.testCode !== test.testCode)];
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

export function getTestByCode(code: string): QuizTest | null {
  const tests = getStoredTests();
  const found = tests.find((t) => t.testCode.toUpperCase() === code.toUpperCase());
  return found || null;
}

export function getStoredResults(): StudentTestResult[] {
  if (typeof window === "undefined") return SEED_RESULTS;
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) {
      localStorage.setItem(RESULTS_KEY, JSON.stringify(SEED_RESULTS));
      return SEED_RESULTS;
    }
    const parsed: StudentTestResult[] = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_RESULTS;
  } catch (e) {
    console.error("Error reading dynoquizz_results from localStorage:", e);
    return SEED_RESULTS;
  }
}

export function saveResult(result: StudentTestResult): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredResults();
    const updated = [result, ...current.filter((r) => r.testCode !== result.testCode)];
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

