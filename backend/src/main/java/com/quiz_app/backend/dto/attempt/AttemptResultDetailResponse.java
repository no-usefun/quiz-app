package com.quiz_app.backend.dto.attempt;

import java.math.BigDecimal;
import java.util.List;

import com.quiz_app.backend.entity.AnswerStatus;

public record AttemptResultDetailResponse(
        Long questionId,
        String questionText,
        Integer displayOrder,
        List<Long> selectedOptionIds,
        List<Long> correctOptionIds,
        AnswerStatus answerStatus,
        boolean correct,
        BigDecimal marksAwarded,
        BigDecimal questionMarks,
        Integer responseTimeSeconds) {
}