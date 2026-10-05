package com.quiz_app.backend.dto.attempt;

import java.time.LocalDateTime;
import java.util.List;

public record AttemptAnswerStateResponse(
        Long questionId,
        List<Long> selectedOptionIds,
        Integer responseTimeSeconds,
        LocalDateTime savedAt) {
}
