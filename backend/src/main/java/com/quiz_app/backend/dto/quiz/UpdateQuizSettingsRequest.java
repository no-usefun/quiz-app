package com.quiz_app.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.quiz_app.backend.entity.ResultVisibility;

public record UpdateQuizSettingsRequest(
        Integer overallTimerSeconds,
        Boolean negativeMarking,
        BigDecimal negativeMarks,
        Boolean timeBonusEnabled,
        Boolean randomQuestionOrder,
        Boolean randomOptionOrder,
        Boolean allowReview,
        Boolean allowResume,
        Boolean autoSubmit,
        Integer maxTabSwitch,
        LocalDateTime startTime,
        LocalDateTime endTime,
        ResultVisibility resultVisibility) {
}