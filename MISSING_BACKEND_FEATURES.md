# Backend Audit & Missing Features Specification (`MISSING_BACKEND_FEATURES.md`)

This document provides a comprehensive technical audit of the Spring Boot backend (`http://localhost:8080`) required to support Quizly's dynamic assessment engine, post-creation feature toggles, student registration whitelisting, real-time telemetry, and conditional score release.

---

## 1. Executive Summary

The Next.js frontend has been transitioned to a **100% dynamic architecture** with zero hardcoded sample quizzes or mock scorecard fallbacks. All operations depend on dynamic backend contracts with local storage caching for offline resilience.

To achieve complete real-time parity, the Spring Boot backend must implement the following controller endpoints, database columns, and DTO contracts:

---

## 2. Required REST Controller Endpoints

### 2.1. Post-Creation Quiz Feature Toggles
* **Endpoint**: `PUT /api/v1/teacher/quizzes/{quizCode}/settings` or `PATCH /api/v1/teacher/quizzes/{quizCode}/settings`
* **Access**: `ROLE_TEACHER`
* **Description**: Allows educators to dynamically toggle settings on live or published assessments (e.g. releasing grades, revealing solution keys, toggling question navigation, or ending the session).
* **Request DTO (`QuizSettingsUpdateDTO`)**:
```json
{
  "publishScoresImmediately": true,
  "revealSolutions": true,
  "allowReview": true,
  "allowResume": true,
  "autoSubmit": true,
  "timeBonusEnabled": true,
  "status": "LIVE"
}
```
* **Response**: `200 OK` with updated Quiz object.

---

### 2.2. Active Attempt Lookup & Duplicate Prevention
* **Endpoint**: `GET /api/v1/student/quizzes/{quizCode}/active-attempt?registrationNo={registrationNo}`
* **Access**: `ROLE_STUDENT`
* **Description**: Checks whether a candidate already has an active, in-progress attempt for the given quiz. Prevents duplicate attempts and race conditions from fast double-clicks or duplicate browser tabs.
* **Response**:
  - `200 OK` with `ActiveAttemptDTO` (containing `attemptId`, `startedAt`, `serverDeadline`, `currentIndex`, `answers`, `timeSpentSeconds`) if in-progress.
  - `404 Not Found` if no active attempt exists (allows creating new attempt).

---

### 2.3. Student Quiz Submission & Grade Persistence
* **Endpoint**: `POST /api/v1/student/quizzes/{quizCode}/submit`
* **Access**: `ROLE_STUDENT`
* **Description**: Receives the student's final submitted answers, evaluates scores, calculates accuracy, and records timestamps into the database.
* **Server-Side Deadline Enforcement**:
  - If submission arrives after `startedAt + overallTimerSeconds + 30s grace window`, the backend returns `408 Request Timeout` or `400 Bad Request` with:
    `{ "success": false, "error": "EXAM_DEADLINE_EXCEEDED", "message": "Assessment time limit has expired on the server." }`
* **Token Expiry Protocol**:
  - If token expired mid-request, returns `401 Unauthorized` with `{ "error": "TOKEN_EXPIRED", "message": "Session expired." }` so client can cache answers and prompt re-auth.
* **Request DTO (`QuizSubmissionRequestDTO`)**:
```json
{
  "testCode": "482910",
  "registrationNo": "21BCE1024",
  "score": 85.5,
  "baseScore": 80,
  "speedBonus": 5.5,
  "accuracyPercentage": 85,
  "totalQuestions": 20,
  "correctCount": 17,
  "answers": {
    "1": "Stack",
    "2": "O(log n)",
    "3": "Heap"
  },
  "timeTakenTotalSeconds": 320
}
```
* **Response**: `200 OK` with `StudentScorecardDTO`.

---

### 2.3. Student Scorecard Fetch (With Release Gate)
* **Endpoint**: `GET /api/v1/student/results/{quizCode}`
* **Access**: `ROLE_STUDENT`
* **Description**: Returns the candidate's scorecard. If the quiz's `publishScoresImmediately` is `false`, the backend must return `published: false` and omit raw score numbers/solutions so results remain securely locked until instructor release.
* **Response DTO (`StudentScorecardDTO`)**:
```json
{
  "testCode": "482910",
  "quizName": "Computer Science Midterm",
  "studentName": "21BCE1024",
  "submittedAt": "2026-08-21T03:30:00Z",
  "published": false,
  "revealSolutions": false,
  "rawScore": 85,
  "adjustedScore": 85,
  "grade": "A",
  "correctCount": 17,
  "totalQuestions": 20,
  "timeTakenTotalSeconds": 320,
  "answers": [
    {
      "questionId": 1,
      "selectedOption": "Stack",
      "timeTakenSeconds": 15
    }
  ]
}
```

---

### 2.4. Student Submissions History
* **Endpoint**: `GET /api/v1/student/results`
* **Access**: `ROLE_STUDENT`
* **Description**: Lists all completed assessment results for the authenticated student token.

---

### 2.5. Real-Time Telemetry & Leaderboard Stream
* **Endpoint**: `GET /api/v1/quizzes/code/{quizCode}/telemetry`
* **Access**: `ROLE_TEACHER`
* **Description**: Returns the live candidate monitoring stream for the assessment room (number of active candidates, answered question counts, and submission statuses).
* **Response DTO (`QuizTelemetryResponseDTO`)**:
```json
{
  "quizCode": "482910",
  "title": "Computer Science Midterm",
  "activeStudentsCount": 24,
  "submittedStudentsCount": 18,
  "students": [
    {
      "id": 1,
      "name": "21BCE1024",
      "answered": 20,
      "total": 20,
      "score": 85,
      "status": "submitted"
    }
  ]
}
```

---

## 3. Database Schema & Migration Script

```sql
-- 1. Extend Quizzes table for extended feature toggles & student whitelisting
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS publish_scores_immediately BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS reveal_solutions BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_review BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS allow_resume BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS auto_submit BOOLEAN DEFAULT TRUE;

-- 2. Create Student Registration Whitelist table
CREATE TABLE IF NOT EXISTS quiz_allowed_registrations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    quiz_id BIGINT NOT NULL,
    registration_number VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    INDEX idx_quiz_reg (quiz_id, registration_number)
);

-- 3. Create Quiz Submissions & Scorecards table
CREATE TABLE IF NOT EXISTS quiz_submissions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    quiz_id BIGINT NOT NULL,
    quiz_code VARCHAR(32) NOT NULL,
    registration_no VARCHAR(64) NOT NULL,
    student_id BIGINT,
    raw_score INT NOT NULL DEFAULT 0,
    adjusted_score INT NOT NULL DEFAULT 0,
    grade VARCHAR(8) NOT NULL DEFAULT 'F',
    correct_count INT NOT NULL DEFAULT 0,
    total_questions INT NOT NULL DEFAULT 0,
    time_taken_seconds INT NOT NULL DEFAULT 0,
    answers_json LONGTEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    INDEX idx_submission_code (quiz_code, registration_no)
);
```

---

## 4. Spring Boot Controller Implementation Blueprint

```java
@RestController
@RequestMapping("/api/v1/teacher/quizzes")
@RequiredArgsConstructor
public class TeacherQuizSettingsController {

    private final QuizRepository quizRepository;

    @PutMapping("/{quizCode}/settings")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<QuizResponseDTO> updateSettings(
            @PathVariable String quizCode,
            @RequestBody QuizSettingsUpdateDTO dto) {
        
        Quiz quiz = quizRepository.findByAccessCode(quizCode)
            .orElseThrow(() -> new ResourceNotFoundException("Quiz not found with code: " + quizCode));
        
        if (dto.getPublishScoresImmediately() != null) {
            quiz.setPublishScoresImmediately(dto.getPublishScoresImmediately());
        }
        if (dto.getRevealSolutions() != null) {
            quiz.setRevealSolutions(dto.getRevealSolutions());
        }
        if (dto.getAllowReview() != null) {
            quiz.setAllowReview(dto.getAllowReview());
        }
        if (dto.getAutoSubmit() != null) {
            quiz.setAutoSubmit(dto.getAutoSubmit());
        }
        if (dto.getStatus() != null) {
            quiz.setStatus(dto.getStatus());
        }
        
        Quiz saved = quizRepository.save(quiz);
        return ResponseEntity.ok(QuizResponseDTO.fromEntity(saved));
    }
}
```

---

## 5. Summary Matrix of Requirements

| Requirement | Frontend Status | Backend Action Item |
| :--- | :--- | :--- |
| **Numeric 6-Digit Codes** | Generates 6-digit numbers | Persist numeric `access_code` column |
| **Student Whitelist** | Whitelist input & client verification | Persist `quiz_allowed_registrations` |
| **Score Persistence** | Submits to `/submit` & local cache | Save to `quiz_submissions` table |
| **Post-Creation Toggles**| UI switches & PUT settings dispatcher | Implement `PUT /settings` controller |
| **Conditional Result Release** | Renders "Pending Release" state | Gate `publishScoresImmediately` in result DTO |
| **Zero Mock Hardcoding** | Fully purged all mock datasets | All data served dynamically from DB |
