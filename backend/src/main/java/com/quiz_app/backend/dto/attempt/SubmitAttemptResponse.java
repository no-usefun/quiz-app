package com.quiz_app.backend.dto.attempt;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.quiz_app.backend.entity.AttemptStatus;

public record SubmitAttemptResponse(
        Long attemptId,
        Long quizId,
        AttemptStatus status,
        BigDecimal finalScore,
        BigDecimal totalMarks,
        Integer totalTimeTaken,
        LocalDateTime submittedAt) {
}