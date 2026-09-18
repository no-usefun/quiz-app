package com.quiz_app.backend.dto.quiz;

import java.time.LocalDateTime;
import java.util.List;

import com.quiz_app.backend.entity.ResultVisibility;

public record CreateQuizRequest(
                Long teacherId,

                String title,
                String description,
                String instructions,

                String subject,
                String subjectCode,
                Integer totalStudents,

                Integer overallTimerSeconds,

                boolean negativeMarking,
                java.math.BigDecimal negativeMarks,

                boolean timeBonusEnabled,
                boolean randomQuestionOrder,
                boolean randomOptionOrder,
                boolean allowReview,
                boolean allowResume,
                boolean autoSubmit,

                LocalDateTime startTime,
                LocalDateTime endTime,

                ResultVisibility resultVisibility,

                List<QuestionRequest> questions) {
}