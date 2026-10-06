package com.quiz_app.backend.dto.proctoring;

public record ProctoringSummaryRequest(
    int totalFaceChecks,
    int identityMatches,
    int identityMismatches
) {}
