package com.quiz_app.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.QuestionType;
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
                ResultVisibility resultVisibility,

                List<QuestionSettingsRequest> questions) {

        public record QuestionSettingsRequest(
                        Long questionId,
                        String questionText,
                        String imageUrl,
                        String explanation,
                        QuestionType questionType,
                        BigDecimal marks,
                        BigDecimal negativeMarks,
                        Integer questionTimerSeconds,
                        Difficulty difficulty,
                        Integer displayOrder,
                        List<OptionSettingsRequest> options) {
        }

        public record OptionSettingsRequest(
                        Long optionId,
                        String optionText,
                        String optionImage,
                        Boolean correct,
                        Short optionOrder) {
        }
}