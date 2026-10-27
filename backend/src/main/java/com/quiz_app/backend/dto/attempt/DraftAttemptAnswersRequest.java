package com.quiz_app.backend.dto.attempt;

import java.util.List;

import jakarta.validation.Valid;

public record DraftAttemptAnswersRequest(
        List<@Valid SubmitAnswerRequest> answers) {
}
