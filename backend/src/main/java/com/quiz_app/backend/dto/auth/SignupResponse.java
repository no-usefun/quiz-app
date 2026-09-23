package com.quiz_app.backend.dto.auth;

public record SignupResponse(
        String message,
        boolean verificationRequired,
        UserSummaryResponse user) {
}