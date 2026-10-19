package com.quiz_app.backend.dto.proctoring;

import java.time.LocalDateTime;
import java.util.List;

public record TeacherProctoringReportResponse(
    Long attemptId,
    Long studentId,
    String studentName,
    String studentEmail,
    String quizCode,
    String quizTitle,
    String status,
    int warningCount,
    int totalViolationsCount,
    int riskScore,
    String riskLevel,
    int totalFaceChecks,
    int identityMatches,
    int identityMismatches,
    int faceAbsenceCount,
    int multipleFacesCount,
    int multiplePersonsCount,
    int lookingAwayCount,
    int phoneDetectionsCount,
    int voiceDetectionsCount,
    int tabSwitchesCount,
    LocalDateTime startedAt,
    LocalDateTime submittedAt,
    List<ProctoringEventDetail> events
) {
    public record ProctoringEventDetail(
        Long id,
        String eventType,
        String details,
        String severity,
        Double confidence,
        LocalDateTime timestamp
    ) {}
}
