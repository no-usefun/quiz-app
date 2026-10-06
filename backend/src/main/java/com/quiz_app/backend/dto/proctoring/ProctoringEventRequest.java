package com.quiz_app.backend.dto.proctoring;

public record ProctoringEventRequest(
    String eventType,
    String details,
    String severity,
    Double confidence,
    Double frameTimestamp
) {}
