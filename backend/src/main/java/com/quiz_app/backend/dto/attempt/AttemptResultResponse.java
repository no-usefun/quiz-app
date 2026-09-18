package com.quiz_app.backend.dto.attempt;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.quiz_app.backend.entity.AttemptStatus;

public record AttemptResultResponse(
        Long attemptId,
        Long quizId,
        String quizTitle,
        Long studentId,
        AttemptStatus status,
        BigDecimal finalScore,
        BigDecimal totalMarks,
        BigDecimal percentage,
        Integer totalTimeTaken,
        LocalDateTime startedAt,
        LocalDateTime submittedAt) {
}