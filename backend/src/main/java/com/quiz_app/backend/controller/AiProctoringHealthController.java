package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.proctoring.AiProctoringHealthResponse;
import com.quiz_app.backend.service.AiProctoringClient;

@RestController
@RequestMapping("/api/v1/proctoring")
public class AiProctoringHealthController {

    private final AiProctoringClient aiProctoringClient;

    public AiProctoringHealthController(AiProctoringClient aiProctoringClient) {
        this.aiProctoringClient = aiProctoringClient;
    }

    /**
     * Reports the status of the separate Python AI proctoring service.
     * This endpoint does not expose camera frames or start an AI session.
     */
    @GetMapping("/ai-health")
    public ResponseEntity<AiProctoringHealthResponse> checkAiHealth() {
        AiProctoringHealthResponse response = aiProctoringClient.checkHealth();
        return response.reachable()
                ? ResponseEntity.ok(response)
                : ResponseEntity.status(503).body(response);
    }
}
