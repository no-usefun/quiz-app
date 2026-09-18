package com.quiz_app.backend.dto.attempt;

import java.util.List;

public record SubmitAnswerRequest(
        Long questionId,
        List<Long> selectedOptionIds,
        Integer responseTimeSeconds) {
}