package com.quiz_app.backend.dto.auth;

public record AuthResponse(
        String token,
        String tokenType,
        long expiresIn,
        UserSummaryResponse user
) {
    public AuthResponse(String token, long expiresIn, UserSummaryResponse user) {
        this(token, "Bearer", expiresIn, user);
    }
}
