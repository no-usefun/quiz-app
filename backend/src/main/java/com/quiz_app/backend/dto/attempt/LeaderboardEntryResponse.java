package com.quiz_app.backend.dto.attempt;

import java.math.BigDecimal;

public record LeaderboardEntryResponse(
        Integer rank,
        Long studentId,
        String studentName,
        BigDecimal score,
        BigDecimal totalMarks,
        BigDecimal percentage,
        Integer totalTimeTaken) {
}