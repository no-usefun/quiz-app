package com.quiz_app.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;

public record QuizResponse(
                Long quizId,
                String quizCode,
                Long teacherId,

                String title,
                String description,
                String instructions,

                String subject,
                String subjectCode,

                Integer totalStudents,
                Integer totalQuestions,
                BigDecimal totalMarks,

                Integer overallTimerSeconds,

                boolean negativeMarking,
                BigDecimal negativeMarks,

                boolean timeBonusEnabled,
                boolean randomQuestionOrder,
                boolean randomOptionOrder,
                boolean allowReview,
                boolean allowResume,
                boolean autoSubmit,

                LocalDateTime startTime,
                LocalDateTime endTime,

                ResultVisibility resultVisibility,
                boolean resultsPublished,

                QuizStatus status,
                ExamState examState) {
}