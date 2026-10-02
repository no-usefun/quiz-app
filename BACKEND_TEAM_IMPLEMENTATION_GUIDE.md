# Backend Team Implementation Guide — Quizly Frontend Integration

## Purpose

This document describes backend work required to complete the new frontend integrations on branch features/frontend.

Documentation only: do not copy backend source changes from the frontend branch. Implement backend changes on features/backend.

The current backend already provides authentication, email verification, Google OAuth, teacher quiz management, student availability, attempt creation, overall deadlines, final submission/scoring, negative marking, result publication, question-wise results, and leaderboards.

## Required backend changes

### 1. Server answer autosave

Endpoint:

PUT /api/v1/student/attempts/{attemptId}/questions/{questionId}/answer

Request:
{
  "selectedOptionIds": [101, 102],
  "responseTimeSeconds": 37
}

Requirements:
- derive student identity from JWT
- verify attempt ownership
- verify attempt is IN_PROGRESS
- verify question belongs to the quiz
- verify every selected option belongs to that question
- enforce MCQ/MSQ/TRUE_FALSE selection rules
- reject writes after the authoritative deadline
- upsert the existing StudentAnswer and StudentSelectedOption records

Recommended response:
{
  "attemptId": 123,
  "questionId": 10,
  "responseTimeSeconds": 37,
  "savedAt": "2026-10-03T01:00:00"
}

The current schema already contains StudentAnswer and StudentSelectedOption, so a separate answer table is unnecessary.

### 2. Server attempt-state restore

Endpoint:

GET /api/v1/student/attempts/{attemptId}/state

Recommended response:
{
  "attemptId": 123,
  "quizId": 45,
  "status": "IN_PROGRESS",
  "effectiveDeadline": "2026-10-03T01:30:00",
  "currentQuestion": 5,
  "totalTimeTaken": 287,
  "answers": [
    {
      "questionId": 10,
      "selectedOptionIds": [101],
      "responseTimeSeconds": 37,
      "savedAt": "2026-10-03T01:02:10"
    }
  ]
}

The endpoint must be student-owned. The frontend uses local browser recovery only when this endpoint is unavailable.

### 3. Enforce allowResume

Current start-attempt behavior resumes any IN_PROGRESS attempt.

Required behavior:
- allowResume=true: return the existing attempt and authoritative deadline.
- allowResume=false: reject an unfinished existing attempt.

Recommended response:
HTTP 409
{
  "errorCode": "ATTEMPT_RESUME_NOT_ALLOWED",
  "message": "This assessment does not allow an unfinished attempt to be resumed."
}

### 4. Authoritative per-question timing

The backend stores questionTimerSeconds but does not currently enforce it.

Required behavior:
- overallTimerSeconds remains the hard assessment deadline
- questionTimerSeconds is the maximum active time for an individual question
- first activation starts the question timer
- revisiting a question must not reset its timer
- the earlier of the question deadline and overall deadline wins
- answer writes after question expiry are rejected

Recommended endpoint:

POST /api/v1/student/attempts/{attemptId}/questions/{questionId}/activate

Recommended response:
{
  "attemptId": 123,
  "questionId": 10,
  "questionTimerSeconds": 60,
  "questionStartedAt": "2026-10-03T01:00:00",
  "questionDeadline": "2026-10-03T01:01:00",
  "expired": false
}

Recommended new table:
quiz_attempt_question

Suggested fields:
id, attempt_id, question_id, started_at, deadline_at, elapsed_seconds, expired, completed_at, created_at, updated_at

Add a unique constraint on attempt_id + question_id.

### 5. Stable randomized order per attempt

The current student package service uses Collections.shuffle() whenever the package is built.

For a resumable assessment this must be stable for one attempt.

Persist the server-generated question order and option order per attempt, either as:
- attempt-question/order tables, or
- an attempt-specific ordering snapshot.

Refreshing or resuming the same attempt must never change its order.

### 6. Deadline and auto-submit semantics

The frontend now uses:
- autoSubmit=true: automatically trigger submission at the authoritative deadline.
- autoSubmit=false: lock answer entry at deadline and show an explicit submit action.

Backend must remain authoritative:
- no answer writes after deadline
- no client can extend effectiveDeadline
- submission at/after deadline is finalized according to deadline state

A minimal compatible model is to finalize deadline-driven attempts as AUTO_SUBMITTED.

### 7. Proctoring event persistence

Endpoint:

POST /api/v1/student/attempts/{attemptId}/proctoring/events

Request:
{
  "type": "tab_switch",
  "occurredAt": "2026-10-03T01:05:30.000Z",
  "metadata": {
    "source": "browser"
  }
}

Frontend event types:
- tab_switch
- fullscreen_exit
- right_click
- copy_attempt
- cut_attempt
- paste_attempt
- focus_loss
- keyboard_attempt
- refresh_count
- reconnect_count

Recommended table:
quiz_attempt_proctoring_event

Suggested fields:
id, attempt_id, event_type, occurred_at, metadata_json, created_at

Verify attempt ownership and reject events for completed/non-active attempts.

### 8. maxTabSwitch enforcement

maxTabSwitch already exists in the quiz model.

Backend should count persisted tab_switch events and enforce the configured limit.

A deterministic termination policy must be selected. Recommended:
- count <= maxTabSwitch: attempt remains active
- count > maxTabSwitch: terminate/auto-submit
- store a termination reason such as TAB_SWITCH_LIMIT

Do not rely on the browser counter for enforcement.

### 9. Attempt heartbeat

Endpoint:

POST /api/v1/student/attempts/{attemptId}/heartbeat

Request:
{
  "currentQuestion": 7
}

Recommended behavior:
- verify ownership
- verify attempt is active
- update lastSeenAt
- update currentQuestion
- optionally update connection-related counters

Recommended response:
{
  "attemptId": 123,
  "lastSeenAt": "2026-10-03T01:10:00"
}

Add last_seen_at to QuizAttempt if it is not already present.

### 10. Teacher live active-attempt monitoring

Endpoint:

GET /api/v1/teacher/quizzes/{quizId}/attempts/live

Recommended response:
[
  {
    "attemptId": 123,
    "studentId": 88,
    "studentName": "Student Name",
    "quizId": 45,
    "status": "IN_PROGRESS",
    "currentQuestion": 7,
    "startedAt": "2026-10-03T01:00:00",
    "lastSeenAt": "2026-10-03T01:10:00",
    "totalTimeTaken": 600,
    "warningCount": 1,
    "tabSwitchCount": 1,
    "fullscreenExitCount": 0,
    "focusLossCount": 0,
    "copyAttemptCount": 0,
    "cutAttemptCount": 0,
    "pasteAttemptCount": 0,
    "keyboardAttemptCount": 0,
    "reconnectCount": 1,
    "refreshCount": 0
  }
]

Only the owning teacher may access this endpoint.

### 11. Time bonus

timeBonusEnabled exists but is not currently applied in scoring.

A business formula must be confirmed before implementation; do not invent the formula in the frontend.

Once the formula is defined, return:
- timeBonusAwarded
- optionally timeBonusApplied

The frontend is already prepared to display these fields.

### 12. Solution explanations

The current result-details contract returns question IDs, selected option IDs, correct option IDs, marks, and response time.

Add:
explanation

Return explanations only when the configured result policy allows question-wise solutions.

### 13. Forgot password

Add:

POST /api/v1/auth/forgot-password

Request:
{
  "email": "student@example.com"
}

Requirements:
- create a short-lived, single-use reset token
- send email through the backend email service
- do not disclose whether an account exists

Recommended generic response:
{
  "success": true,
  "message": "If the account is eligible, a password reset email has been sent."
}

### 14. Reset password

Add:

POST /api/v1/auth/reset-password

Request:
{
  "token": "opaque-reset-token",
  "newPassword": "new-secret"
}

Requirements:
- hash token before storage
- short expiration
- single use
- invalidate previous unused tokens when issuing a new one
- use the existing PasswordEncoder

### 15. Notification preferences

Add:

GET /api/v1/auth/me/notification-preferences

PUT /api/v1/auth/me/notification-preferences

Frontend model:
{
  "assessmentResults": true,
  "upcomingAssessments": true,
  "proctoringReports": false,
  "browserPush": false
}

Recommended table:
user_notification_preferences

Use a one-to-one relationship with User.

## Existing backend fields that should be reused

Quiz already has:
- overallTimerSeconds
- questionTimerSeconds on Question
- negativeMarking
- negativeMarks
- timeBonusEnabled
- randomQuestionOrder
- randomOptionOrder
- allowReview
- allowResume
- autoSubmit
- maxTabSwitch
- startTime
- endTime
- resultVisibility
- acceptedEmailDomain

QuizAttempt already has:
- currentQuestion
- totalTimeTaken
- warningsCount
- refreshCount
- reconnectCount

Reuse these instead of creating duplicate concepts.

## Security rules

Never trust browser values as authoritative for:
- student identity
- teacher identity
- quiz ownership
- exam deadline
- score
- correctness
- total marks
- time bonus
- proctoring totals
- tab-switch limit

All new student endpoints must derive the student from the authenticated JWT.

## Acceptance tests

1. Answer -> refresh -> server restores the saved answer.
2. Disconnect/reconnect does not extend the deadline.
3. Resume-enabled attempt returns the same attempt ID and deadline.
4. Resume-disabled attempt returns a deterministic 409 error.
5. Expired question rejects subsequent answer writes.
6. Overall deadline cannot be extended by client timestamps.
7. Randomized order remains identical after refresh/resume.
8. Proctoring events are persisted and visible to the teacher.
9. maxTabSwitch follows the agreed termination policy.
10. Live teacher monitoring shows active attempts and last-seen/current-question state.
11. Time bonus is calculated only by the backend.
12. Explanations are protected by result visibility policy.
13. Password reset tokens expire and are single-use.
14. Notification preferences survive a new login/browser.
15. Students cannot access another student's attempt state, answers, proctoring events, or results.

## Frontend status

The features/frontend branch is prepared for all contracts above.

New frontend integrations include:
- per-question timers
- server answer autosave
- server attempt-state restore
- proctoring event synchronization
- refresh/reconnect tracking
- exam heartbeat/current-question updates
- teacher live active-attempt monitoring
- student leaderboard
- OAuth password setup
- forgot/reset password pages
- notification preference synchronization
- solution explanation display
- time bonus display
- teacher controls for timing, review, resume, randomization, auto-submit, and tab-switch limits

Until the new backend endpoints exist, the frontend uses graceful local fallback for those specific new calls rather than fabricating server data.
