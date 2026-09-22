package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;
import java.util.List;

public record AnswerResponse(
        Long answerId,
        Long attemptId,
        Long questionId,
        List<Long> selectedOptionIds,
        Integer responseTimeSeconds,
        LocalDateTime answeredAt) {
}