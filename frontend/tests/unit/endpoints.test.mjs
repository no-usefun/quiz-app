import test from "node:test";
import assert from "node:assert/strict";
import { API_BASE, ENDPOINTS } from "../../src/lib/api/endpoints.ts";

test("all frontend API calls use the same-origin backend proxy", () => {
  assert.equal(API_BASE, "/backend");
  assert.ok(ENDPOINTS.system.health.startsWith(API_BASE));
  assert.ok(ENDPOINTS.auth.login.startsWith(API_BASE));
  assert.ok(ENDPOINTS.student.startAttempt("QUIZ-1").startsWith(API_BASE));
});

test("student quiz codes are URL encoded", () => {
  assert.equal(
    ENDPOINTS.student.startAttempt("BIO/101 A"),
    "/backend/api/v1/student/quizzes/BIO%2F101%20A/attempts",
  );
  assert.equal(
    ENDPOINTS.student.quizPackageByCode("BIO/101 A"),
    "/backend/api/v1/student/quizzes/code/BIO%2F101%20A/package",
  );
});

test("attempt endpoints preserve numeric and string identifiers", () => {
  assert.equal(ENDPOINTS.student.submitAttempt(42), "/backend/api/v1/student/attempts/42/submit");
  assert.equal(ENDPOINTS.student.attemptState("attempt-42"), "/backend/api/v1/student/attempts/attempt-42/state");
  assert.equal(ENDPOINTS.student.proctoringEvents(42), "/backend/api/v1/student/attempts/42/proctoring/events");
});

test("teacher proctoring endpoint builders include report and re-permission routes", () => {
  assert.equal(
    ENDPOINTS.proctoring.teacherQuizReport("QUIZ/101"),
    "/backend/api/v1/teacher/proctoring/quizzes/QUIZ%2F101/report",
  );
  assert.equal(
    ENDPOINTS.proctoring.teacherAttemptReport(42),
    "/backend/api/v1/teacher/proctoring/attempts/42",
  );
  assert.equal(
    ENDPOINTS.proctoring.teacherRepermitAttempt(42),
    "/backend/api/v1/teacher/proctoring/attempts/42/repermit",
  );
});
