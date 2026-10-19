package com.quiz_app.backend.dto.proctoring;

public record ProctoringEventResponse(
    boolean recorded,
    int warningCount,
    boolean autoSubmitted,
    String message
) {}
