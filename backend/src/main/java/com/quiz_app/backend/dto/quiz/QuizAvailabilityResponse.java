package com.quiz_app.backend.dto.quiz;

import java.time.LocalDateTime;

import com.quiz_app.backend.entity.QuizAvailabilityStatus;

public record QuizAvailabilityResponse(
        String quizCode,
        boolean available,
        QuizAvailabilityStatus status,
        LocalDateTime startTime,
        LocalDateTime endTime) {
}