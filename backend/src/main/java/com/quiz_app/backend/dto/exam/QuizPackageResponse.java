package com.quiz_app.backend.dto.exam;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record QuizPackageResponse(
        Long quizId,
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

        boolean randomQuestionOrder,
        boolean randomOptionOrder,
        boolean allowReview,
        boolean allowResume,
        boolean autoSubmit,

        LocalDateTime startTime,
        LocalDateTime endTime,

        List<QuestionResponse> questions) {
}