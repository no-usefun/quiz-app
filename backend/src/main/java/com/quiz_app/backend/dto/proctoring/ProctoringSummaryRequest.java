package com.quiz_app.backend.dto.proctoring;

import jakarta.validation.constraints.Min;

public record ProctoringSummaryRequest(
    @Min(0) int totalFaceChecks,
    @Min(0) int identityMatches,
    @Min(0) int identityMismatches
) {}
