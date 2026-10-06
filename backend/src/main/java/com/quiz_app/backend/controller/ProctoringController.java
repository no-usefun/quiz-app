package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.proctoring.ProctoringEventRequest;
import com.quiz_app.backend.dto.proctoring.ProctoringEventResponse;
import com.quiz_app.backend.dto.proctoring.ProctoringSummaryRequest;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.ProctoringService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/attempts")
public class ProctoringController {

    private final ProctoringService proctoringService;

    public ProctoringController(ProctoringService proctoringService) {
        this.proctoringService = proctoringService;
    }

    @PostMapping("/{attemptId}/events")
    public ResponseEntity<ProctoringEventResponse> recordProctoringEvent(
            @PathVariable Long attemptId,
            @Valid @RequestBody ProctoringEventRequest request,
            Authentication authentication) {

        Long userId = null;
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails userDetails) {
            userId = userDetails.getId();
        }

        ProctoringEventResponse response = proctoringService.recordProctoringEvent(attemptId, request, userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{attemptId}/proctoring-summary")
    public ResponseEntity<Void> recordProctoringSummary(
            @PathVariable Long attemptId,
            @Valid @RequestBody ProctoringSummaryRequest request,
            Authentication authentication) {

        Long userId = null;
        if (authentication != null && authentication.getPrincipal() instanceof CustomUserDetails userDetails) {
            userId = userDetails.getId();
        }

        proctoringService.recordProctoringSummary(attemptId, request, userId);
        return ResponseEntity.ok().build();
    }
}
