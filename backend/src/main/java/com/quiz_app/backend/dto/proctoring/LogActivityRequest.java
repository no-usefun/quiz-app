package com.quiz_app.backend.dto.proctoring;

import java.time.LocalDateTime;

import com.quiz_app.backend.entity.ActivityType;

import jakarta.validation.constraints.NotNull;

public record LogActivityRequest(
        Long questionId,

        @NotNull(message = "Activity type is required")
        ActivityType activityType,

        String details,

        LocalDateTime activityTime
) {
}
