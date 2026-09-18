package com.quiz_app.backend.dto.proctoring;

import java.util.List;

import com.quiz_app.backend.entity.AttemptStatus;

public record ProctoringSummaryResponse(
        Long attemptId,
        Long studentId,
        String studentName,
        String studentEmail,
        AttemptStatus status,
        int totalViolations,
        int tabSwitches,
        int fullscreenExits,
        int faceWarnings,
        int voiceWarnings,
        boolean isIntegrityFlagged,
        List<ActivityLogResponse> recentViolations
) {
}
