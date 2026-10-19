package com.quiz_app.backend.dto.proctoring;

import java.util.Map;

public record AiProctoringHealthResponse(
        boolean reachable,
        String status,
        String service,
        boolean biometricAvailable,
        Map<String, Boolean> models,
        String message) {
}
