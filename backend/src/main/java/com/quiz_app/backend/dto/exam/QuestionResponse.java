package com.quiz_app.backend.dto.exam;

import java.math.BigDecimal;
import java.util.List;

import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.QuestionType;

public record QuestionResponse(
        Long questionId,
        String questionText,
        String imageUrl,
        QuestionType questionType,
        BigDecimal marks,
        BigDecimal negativeMarks,
        Integer questionTimerSeconds,
        Difficulty difficulty,
        Integer displayOrder,
        List<OptionResponse> options) {
}