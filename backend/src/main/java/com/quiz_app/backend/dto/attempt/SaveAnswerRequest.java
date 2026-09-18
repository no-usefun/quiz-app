package com.quiz_app.backend.dto.attempt;

import java.util.List;

public record SaveAnswerRequest(
        List<Long> selectedOptionIds,
        Integer responseTimeSeconds) {
}