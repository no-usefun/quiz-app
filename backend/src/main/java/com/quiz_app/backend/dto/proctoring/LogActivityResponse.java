package com.quiz_app.backend.dto.proctoring;

public record LogActivityResponse(
        boolean success,
        int currentWarningsCount,
        int maxAllowedWarnings,
        boolean warningExceeded,
        boolean autoSubmitted,
        String message
) {
}
