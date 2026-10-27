package com.quiz_app.backend.dto.attempt;

import com.quiz_app.backend.entity.AttemptStatus;

public record DraftAttemptAnswersResponse(
        Long attemptId,
        boolean saved,
        AttemptStatus status) {
}
