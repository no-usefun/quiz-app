package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;

import com.quiz_app.backend.entity.AttemptStatus;

public record AttemptStateResponse(
        Long attemptId,
        Long quizId,
        AttemptStatus status,
        OffsetDateTime effectiveDeadline,
        Integer currentQuestion,
        Integer totalTimeTaken,
        List<AttemptAnswerStateResponse> answers) {
}
