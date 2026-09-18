package com.quiz_app.backend.dto.proctoring;

import java.time.LocalDateTime;

import com.quiz_app.backend.entity.ActivityLog;
import com.quiz_app.backend.entity.ActivityType;

public record ActivityLogResponse(
        Long activityId,
        Long attemptId,
        Long questionId,
        ActivityType activityType,
        LocalDateTime activityTime,
        String details,
        boolean isViolation
) {
    public static ActivityLogResponse fromEntity(ActivityLog log) {
        return new ActivityLogResponse(
                log.getId(),
                log.getAttempt() != null ? log.getAttempt().getId() : null,
                log.getQuestion() != null ? log.getQuestion().getId() : null,
                log.getActivityType(),
                log.getActivityTime(),
                log.getDetails(),
                log.getActivityType() != null && log.getActivityType().isViolation()
        );
    }
}
