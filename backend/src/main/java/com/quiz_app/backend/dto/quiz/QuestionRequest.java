package com.quiz_app.backend.dto.quiz;

import java.math.BigDecimal;
import java.util.List;

import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.QuestionType;

public record QuestionRequest(
        String questionText,
        String imageUrl,
        String explanation,
        QuestionType questionType,
        BigDecimal marks,
        BigDecimal negativeMarks,
        Integer questionTimerSeconds,
        Difficulty difficulty,
        Integer displayOrder,
        List<OptionRequest> options) {
}