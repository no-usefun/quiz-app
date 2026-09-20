package com.quiz_app.backend.dto.quiz;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;

public record TeacherQuizDetailResponse(

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

        Integer maxTabSwitch,

        LocalDateTime startTime,
        LocalDateTime endTime,

        ResultVisibility resultVisibility,
        boolean resultsPublished,

        String acceptedEmailDomain,
        List<String> allowedRegistrationNumbers,

        QuizStatus status,
        ExamState examState,

        List<QuestionDetail> questions

) {

    public record QuestionDetail(

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

            List<OptionDetail> options

    ) {
    }

    public record OptionDetail(

            Long optionId,

            String optionText,
            String optionImage,

            boolean correct,

            Short optionOrder

    ) {
    }
}