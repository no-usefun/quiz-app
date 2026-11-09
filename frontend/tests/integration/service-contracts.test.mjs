import test from "node:test";
import assert from "node:assert/strict";
import { API_BASE, ENDPOINTS } from "../../src/lib/api/endpoints.ts";

// Contract-level integration checks: the browser proxy routes the frontend's
// student, teacher, and AI-proctoring workflows to the Spring Boot API paths.
test("student attempt and AI-proctoring lifecycle share one attempt identifier", () => {
  const attemptId = 9081;
  const expected = [
    ENDPOINTS.student.submitAttempt(attemptId),
    ENDPOINTS.student.attemptState(attemptId),
    ENDPOINTS.proctoring.verifyAccess(attemptId),
    ENDPOINTS.proctoring.recordEvent(attemptId),
    ENDPOINTS.proctoring.summary(attemptId),
    ENDPOINTS.proctoring.aiHealth,
  ];
  for (const endpoint of expected) {
    assert.ok(endpoint.startsWith(API_BASE), `Expected same-origin proxy path: ${endpoint}`);
    assert.ok(endpoint.startsWith("/backend/api/v1/"), `Expected versioned backend API path: ${endpoint}`);
  }
  assert.match(ENDPOINTS.proctoring.verifyAccess(attemptId), new RegExp(`/attempts/${attemptId}/verify-access$`));
  assert.match(ENDPOINTS.proctoring.recordEvent(attemptId), new RegExp(`/attempts/${attemptId}/events$`));
});

test("teacher live monitoring exposes report and re-permission contracts", () => {
  const quizCode = "CS/2026";
  const attemptId = 9081;
  assert.match(ENDPOINTS.proctoring.teacherQuizReport(quizCode), /\/teacher\/proctoring\/quizzes\/CS%2F2026\/report$/);
  assert.match(ENDPOINTS.proctoring.teacherAttemptReport(attemptId), /\/teacher\/proctoring\/attempts\/9081$/);
  assert.match(ENDPOINTS.proctoring.teacherRepermitAttempt(attemptId), /\/teacher\/proctoring\/attempts\/9081\/repermit$/);
});
