package com.quiz_app.backend.dto.proctoring;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

public record BatchLogActivityRequest(
        @NotEmpty(message = "Events list cannot be empty")
        List<@Valid LogActivityRequest> events
) {
}
