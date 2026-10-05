package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;
import java.util.List;

import com.quiz_app.backend.entity.AttemptStatus;

public record AttemptStateResponse(
        Long attemptId,
        Long quizId,
        AttemptStatus status,
        LocalDateTime effectiveDeadline,
        Integer currentQuestion,
        Integer totalTimeTaken,
        List<AttemptAnswerStateResponse> answers) {
}
