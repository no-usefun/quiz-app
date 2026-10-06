package com.quiz_app.backend.dto.proctoring;

public record ProctoringAccessVerificationResponse(
    Long attemptId,
    String studentId,
    String studentEmail,
    String testCode,
    String status,
    boolean valid,
    String message
) {
}
