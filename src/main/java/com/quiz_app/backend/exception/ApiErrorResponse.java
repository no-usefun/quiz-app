package com.quiz_app.backend.exception;

import java.time.LocalDateTime;

public record ApiErrorResponse(
        LocalDateTime timestamp,
        int status,
        String error,
        String message,
        String path) {
}