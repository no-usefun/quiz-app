package com.quiz_app.backend.dto.auth;

public record NotificationPreferencesResponse(
        boolean assessmentResults,
        boolean upcomingAssessments,
        boolean proctoringReports,
        boolean browserPush) {
}
