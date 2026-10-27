package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;
import java.util.Map;

import jakarta.validation.constraints.NotBlank;

public record ProctoringEventRequest(
        @NotBlank(message = "Event type is required")
        String type,
        LocalDateTime occurredAt,
        Map<String, Object> metadata,
        String clientEventId) {

    public ProctoringEventRequest(String type, LocalDateTime occurredAt, Map<String, Object> metadata) {
        this(type, occurredAt, metadata, null);
    }
}