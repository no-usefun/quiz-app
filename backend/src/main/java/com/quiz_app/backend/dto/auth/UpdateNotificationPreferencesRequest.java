package com.quiz_app.backend.dto.auth;

public record UpdateNotificationPreferencesRequest(
        Boolean assessmentResults,
        Boolean upcomingAssessments,
        Boolean proctoringReports,
        Boolean browserPush) {
}
