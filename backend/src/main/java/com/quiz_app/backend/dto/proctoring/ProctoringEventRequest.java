package com.quiz_app.backend.dto.proctoring;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProctoringEventRequest(
    @NotBlank @Size(max = 40) String eventType,
    @Size(max = 1000) String details,
    @Size(max = 20) String severity,
    @DecimalMin("0.0") @DecimalMax("1.0") Double confidence,
    @DecimalMin("946684800.0") Double frameTimestamp,
    @Size(max = 100) String eventId
) {
    // Preserve compatibility with clients that have not yet adopted durable event IDs.
    public ProctoringEventRequest(String eventType, String details, String severity, Double confidence, Double frameTimestamp) {
        this(eventType, details, severity, confidence, frameTimestamp, null);
    }
}
