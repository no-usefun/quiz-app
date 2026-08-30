package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;

import com.quiz_app.backend.entity.AttemptStatus;

public record AttemptResponse(
        Long attemptId,
        Long quizId,
        Long studentId,
        LocalDateTime startedAt,
        LocalDateTime submittedAt,
        AttemptStatus status,
        Integer currentQuestion,
        Integer totalTimeTaken) {
}