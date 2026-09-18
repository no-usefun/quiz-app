package com.quiz_app.backend.dto.proctoring;

import java.util.List;

public record QuizProctoringOverviewResponse(
        Long quizId,
        String quizTitle,
        String quizCode,
        int totalAttempts,
        int inProgressAttempts,
        int flaggedAttempts,
        int totalViolations,
        List<ProctoringSummaryResponse> candidates
) {
}
