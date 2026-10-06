package com.quiz_app.backend.dto.exam;

import java.time.LocalDateTime;

public record OfflineExamStatusResponse(
        Long quizId,
        String quizCode,
        String title,
        String status,
        boolean databaseReady,
        int questionCount,
        int allowedStudentCount,
        LocalDateTime preparedAt,
        LocalDateTime startedAt,
        LocalDateTime endedAt) {}
