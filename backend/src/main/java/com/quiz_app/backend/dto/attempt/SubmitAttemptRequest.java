package com.quiz_app.backend.dto.attempt;

import java.util.List;

public record SubmitAttemptRequest(
        List<SubmitAnswerRequest> answers) {
}