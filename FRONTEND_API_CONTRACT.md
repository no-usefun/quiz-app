FRONTEND_API_CONTRACT.md

DynoQuizz — Current Frontend ↔ Backend API Contract

Purpose: Authoritative frontend integration instructions for the current Spring Boot backend. Antigravity cannot inspect the backend repository, so it must follow this file rather than historical frontend assumptions.

Source-of-truth priority: Current backend contract supplied by the project team > this document > existing frontend code.

If existing frontend code conflicts with this document, change the frontend to match this document.

1. GLOBAL RULES

DO NOT:

invent API endpoints;

invent request/response fields;

silently fall back to legacy endpoints;

use mock data to hide API failures;

generate database IDs on the frontend;

use 0 as a backend-ID placeholder;

bypass authentication or role restrictions;

treat localStorage as the backend source of truth.

The backend is authoritative for persisted quiz, attempt, score, status, and identifier data.

Use:

NEXT_PUBLIC_API_URL=https://quiz-app-s033.onrender.com

API calls must use process.env.NEXT_PUBLIC_API_URL.

2. AUTHENTICATION

Login

POST /api/v1/auth/login

Body:

{
"email": "user@example.com",
"password": "password"
}

Do not make role a required backend request field.

Protected requests:

Authorization: Bearer <JWT>

Signup

POST /api/v1/auth/signup

Current backend fields:

{
"firstName": "Jane",
"lastName": "Doe",
"email": "jane@example.com",
"password": "password",
"role": "STUDENT",
"college": "...",
"department": "...",
"registrationNo": "...",
"phone": "..."
}

Do not use /api/v1/auth/register.

Current user

GET /api/v1/auth/me

Use the response as the authoritative authenticated-user profile.

3. IDENTIFIERS

These are different:

quizId = numeric database ID, e.g. 35

quizCode = public access code, e.g. 957800

attemptId = numeric student-attempt ID

Never interchange them.

Examples:

GET /api/v1/teacher/quizzes/35
GET /api/v1/quizzes/code/957800/package
POST /api/v1/student/quizzes/957800/attempts
POST /api/v1/student/attempts/17/submit

Never pass quizId where quizCode is expected.

4. TEACHER — CREATE QUIZ

POST /api/v1/teacher/quizzes

Headers:

Authorization: Bearer <JWT>
Content-Type: application/json

Current CreateQuizRequest:

{
"title": "Data Structures Exam",
"description": "Exam description",
"instructions": "Exam instructions",
"subject": "Data Structures",
"subjectCode": "CS302",
"totalStudents": 30,
"overallTimerSeconds": 1800,
"negativeMarking": false,
"negativeMarks": 0,
"timeBonusEnabled": false,
"randomQuestionOrder": true,
"randomOptionOrder": true,
"allowReview": true,
"allowResume": true,
"autoSubmit": true,
"startTime": "2026-09-21T16:46:00",
"endTime": "2026-09-21T17:16:00",
"resultVisibility": "NONE",
"acceptedEmailDomain": null,
"allowedRegistrationNumbers": [],
"questions": [
{
"questionText": "What is ...?",
"imageUrl": "",
"explanation": "",
"questionType": "MCQ",
"marks": 1,
"negativeMarks": 0,
"questionTimerSeconds": 60,
"difficulty": "MEDIUM",
"displayOrder": 1,
"options": [
{
"optionText": "Option A",
"optionImage": "",
"optionOrder": 1,
"isCorrect": true
},
{
"optionText": "Option B",
"optionImage": "",
"optionOrder": 2,
"isCorrect": false
}
]
}
]
}

DO NOT send:

teacherId
status
allowedRolls

Use allowedRegistrationNumbers.

Teacher identity is resolved by the backend from the JWT.

5. TEACHER — PUBLISH

Publishing is separate from creation.

PUT /api/v1/teacher/quizzes/{quizId}/publish

Do not publish by sending:

{
"status": "PUBLISHED"
}

The frontend must use the backend-generated quizId and quizCode.

6. TEACHER — QUIZ LIST

GET /api/v1/teacher/quizzes

Use backend data as the source of truth.

Relevant fields may include:

quizId
quizCode
title
description
instructions
subject
subjectCode
totalStudents
totalQuestions
overallTimerSeconds
status
examState
resultVisibility
resultsPublished

LocalStorage may cache this for resilience but must not override fresh backend data.

7. TEACHER — QUIZ DETAIL

GET /api/v1/teacher/quizzes/{quizId}

Use this for teacher-facing quiz details/editing.

The current backend detail response contains quiz settings, questions, options, lifecycle state, result visibility/publication state, max tab switches, and allowed registration numbers.

Questions are ordered by displayOrder.

Options are ordered by optionOrder.

8. TEACHER — UPDATE DRAFT

PUT /api/v1/teacher/quizzes/{quizId}/settings

Current request fields:

{
"overallTimerSeconds": 1800,
"negativeMarking": false,
"negativeMarks": 0,
"timeBonusEnabled": false,
"randomQuestionOrder": true,
"randomOptionOrder": true,
"allowReview": true,
"allowResume": true,
"autoSubmit": true,
"maxTabSwitch": 3,
"startTime": "2026-09-21T16:46:00",
"endTime": "2026-09-21T17:16:00",
"resultVisibility": "NONE",
"acceptedEmailDomain": null,
"allowedRegistrationNumbers": [],
"questions": []
}

Existing question:

{
"questionId": 106,
"questionText": "...",
"imageUrl": "",
"explanation": "",
"questionType": "MCQ",
"marks": 1,
"negativeMarks": 0,
"questionTimerSeconds": 60,
"difficulty": "MEDIUM",
"displayOrder": 1,
"options": []
}

Existing option:

{
"optionId": 400,
"optionText": "Option A",
"optionImage": "",
"correct": true,
"optionOrder": 1
}

CRITICAL:

// Correct
questionId: q.questionId ?? q.id ?? null
optionId: option.optionId ?? option.id ?? null

NEVER:

questionId: q.questionId || 0
optionId: option.optionId || 0

Preserve backend IDs. New entities may omit IDs/null them according to the DTO.

9. TIME CONTRACT

There are two concepts:

overallTimerSeconds

Individual attempt duration.

Example:

1800 = 30 minutes

startTime / endTime

Quiz availability window.

For the current MVP immediate-publish behavior:

publish time = startTime
endTime = startTime + overallTimerSeconds

Example:

publish/start = 16:46
duration = 30 minutes
end = 17:16

Do NOT:

create a 24-hour window;

subtract five minutes from start time;

hardcode +05:30;

use browser clock hacks to bypass backend validation.

10. DATETIME FORMAT

The backend currently uses Java LocalDateTime.

Send:

YYYY-MM-DDTHH:mm:ss

Example:

2026-09-21T16:46:00

Do NOT send Z or a timezone offset for these fields unless the backend contract is explicitly changed.

Do not blindly use:

new Date(value).toISOString()

for backend LocalDateTime fields.

Create one shared frontend conversion helper and use it everywhere.

11. STUDENT — QUIZ PACKAGE

GET /api/v1/quizzes/code/{quizCode}/package

Headers:

Authorization: Bearer <JWT>

Student package provides the authoritative quiz data.

Relevant question fields:

questionId
questionText
marks
negativeMarks
questionTimerSeconds
options

Relevant option fields:

optionId
optionText
optionImage

Do not expose correctness information to students.

12. STUDENT — START ATTEMPT

POST /api/v1/student/quizzes/{quizCode}/attempts

Headers:

Authorization: Bearer <JWT>
Content-Type: application/json

REQUEST BODY: NONE

This is critical.

Do NOT send:

{
"studentId": 42
}

The backend resolves the authenticated student from the JWT/Spring Security context.

Flow:

GET package
↓
Student clicks Start
↓
POST /api/v1/student/quizzes/{quizCode}/attempts
↓
Backend creates/resumes attempt
↓
Backend returns attemptId
↓
Frontend stores attemptId
↓
Test arena

Never fabricate attemptId.

13. START-TIME ERRORS

The backend decides whether a quiz has started.

If it returns:

Quiz has not started yet

display/log that backend error.

Do not bypass it by:

changing browser time;

modifying start time locally;

subtracting minutes;

retrying with fake timestamps;

assuming publication automatically overrides backend time validation.

If backend server timezone/clock handling is wrong, fix that in the backend. The frontend must not compensate with arbitrary offsets.

14. STUDENT — SUBMIT ATTEMPT

POST /api/v1/student/attempts/{attemptId}/submit

Body:

{
"answers": [
{
"questionId": 101,
"selectedOptionIds": [2],
"responseTimeSeconds": 24
},
{
"questionId": 102,
"selectedOptionIds": [4],
"responseTimeSeconds": 15
}
]
}

The current backend submission model sends the complete answer sheet.

Backend performs:

question validation;

option validation;

correctness;

negative marking;

deadline validation;

scoring;

persistence.

The frontend must not calculate the official score.

15. ANSWER AUTOSAVE — CURRENT MVP

Do not make incremental answer saving a dependency of the current flow.

The current backend design does not make the incremental save-answer endpoint the active primary contract.

Use:

React state
↓
localStorage recovery
↓
complete answer sheet
↓
POST submit

If incremental saving is activated later by the backend team, update this contract first.

16. STUDENT — RESULTS

Summary

GET /api/v1/student/attempts/{attemptId}/result

Relevant values:

quizTitle
percentage
finalScore
totalMarks
totalTimeTaken
submittedAt
published

Details

GET /api/v1/student/attempts/{attemptId}/result/details

Relevant values:

questionId
questionText
correctOptionIds
selectedOptionIds
correct
marksAwarded
responseTimeSeconds

Backend result/score is authoritative.

17. ROLE SECURITY

Teacher workflow:

/api/v1/teacher/\*\*

Student workflow:

/api/v1/student/\*\*

Shared quiz/package routes:

/api/v1/quizzes/\*\*

Do not call student-only endpoints from teacher pages.

Do not call teacher-only endpoints from student pages.

Do not remove the Authorization header to work around a 401/403.

18. LOCAL STORAGE

LocalStorage can be used for:

authentication persistence;

draft recovery;

active-test recovery;

temporary answer state;

UI cache.

It is NOT authoritative for:

quizId
quizCode
questionId
optionId
attemptId
quiz status
official score
result publication

Fresh backend responses take precedence.

19. ERROR HANDLING

For failed requests, preserve the backend message:

const error = await response.json().catch(() => ({}));

throw new Error(
error.message ||
error.error ||
`Backend request failed: ${response.status}`
);

Do not silently turn a useful backend error into generic success/fallback behavior.

20. NO SILENT LEGACY FALLBACKS

Do NOT implement:

current endpoint
↓ 404
legacy endpoint
↓
pretend everything is correct

This hides integration problems.

If a current endpoint fails:

log endpoint;

log status;

log backend message;

show appropriate error;

fix against the current backend contract.

Legacy endpoints may only be restored when explicitly requested for backward compatibility.

21. CURRENT MVP END-TO-END FLOW

Teacher

Login
↓
POST /api/v1/auth/login
↓
Teacher Dashboard
↓
POST /api/v1/teacher/quizzes
↓
Receive quizId + quizCode
↓
PUT /api/v1/teacher/quizzes/{quizId}/publish
↓
Published quiz

Student

Login
↓
Enter quizCode
↓
GET /api/v1/quizzes/code/{quizCode}/package
↓
Lobby
↓
Start Assessment
↓
POST /api/v1/student/quizzes/{quizCode}/attempts
↓
Receive attemptId
↓
Test Arena
↓
Answer questions
↓
POST /api/v1/student/attempts/{attemptId}/submit
↓
Backend result

Priority for the current MVP:

Login
→ Create
→ Publish
→ Join
→ Start
→ Answer
→ Submit
→ Result

Do not block this flow on advanced proctoring, incremental autosave, cosmetic redesign, or legacy compatibility.

22. ANTIGRAVITY MUST NOT DECIDE THESE CONTRACTS

These are fixed:

No invented API routes.

No invented request fields.

No studentId in start-attempt request.

No teacherId in create request.

No status in CreateQuizRequest.

No allowedRolls; use allowedRegistrationNumbers.

No interchange of quizId and quizCode.

No questionId: 0.

No optionId: 0.

Preserve backend question/option IDs.

No Date.toISOString() for LocalDateTime fields.

No hardcoded timezone offsets.

No five-minute time workaround.

No 24-hour availability workaround.

No bypassing backend start/end validation.

No assumption that incremental answer saving is active.

No silent legacy endpoint fallback.

No frontend-generated official scores.

No mock API responses in the real flow.

No localStorage overriding fresh backend state.

If a requirement is missing from this document, do not invent backend behavior. Report the missing contract.

23. VALIDATION CHECKLIST

Authentication

Login uses /api/v1/auth/login

Signup uses /api/v1/auth/signup

JWT sent as Bearer token

No frontend-generated JWT

Teacher

Create uses current CreateQuizRequest

No teacherId

No status

Uses allowedRegistrationNumbers

Publish uses /publish

Backend-generated quizId/quizCode preserved

Backend question IDs preserved

Backend option IDs preserved

Time

Timer is seconds

Datetime is YYYY-MM-DDTHH:mm:ss

No Z

No hardcoded timezone

No five-minute workaround

End = start + configured duration for current MVP

Student

Package uses quizCode

Start uses quizCode

Start request has no body

attemptId comes from backend

Complete answer sheet is submitted

Official result comes from backend

Quality

No mock data

No hardcoded quiz IDs/codes

No hardcoded attempt IDs

No silent legacy fallback

npx tsc --noEmit passes

npm run build passes

24. DEFINITION OF DONE

The integration is correct when this real API flow works without hardcoded application data:

Teacher Login
↓
Create Quiz
↓
Backend returns quizId + quizCode
↓
Publish Quiz
↓
Student Login
↓
Enter quizCode
↓
Fetch package
↓
Start Assessment
↓
Backend creates/resumes attempt
↓
Student answers
↓
Student submits complete answer sheet
↓
Backend scores
↓
Student receives backend result

All identifiers, quiz state, attempts, scoring, and results must originate from the backend.

The frontend is responsible for presentation, interaction, temporary recovery state, and sending requests that conform exactly to this contract.
