package com.quiz_app.backend.dto.proctoring;

import java.util.List;

public record TeacherQuizProctoringOverviewResponse(
    String quizCode,
    String quizTitle,
    int totalAttempts,
    int flaggedAttempts,
    int autoSubmittedAttempts,
    double averageRiskScore,
    List<TeacherProctoringReportResponse> studentReports
) {}
