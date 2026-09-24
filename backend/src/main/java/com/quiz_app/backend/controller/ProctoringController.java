package com.quiz_app.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.auth.ApiResponse;
import com.quiz_app.backend.dto.proctoring.ActivityLogResponse;
import com.quiz_app.backend.dto.proctoring.BatchLogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityResponse;
import com.quiz_app.backend.dto.proctoring.ProctoringSummaryResponse;
import com.quiz_app.backend.dto.proctoring.QuizProctoringOverviewResponse;
import com.quiz_app.backend.dto.proctoring.RegisterDeviceRequest;
import com.quiz_app.backend.service.ProctoringService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1")
public class ProctoringController {

    private final ProctoringService proctoringService;

    public ProctoringController(ProctoringService proctoringService) {
        this.proctoringService = proctoringService;
    }

    // ─── Candidate Endpoints ──────────────────────────────────────────────────

    @PostMapping("/attempts/{attemptId}/activities")
    public ResponseEntity<LogActivityResponse> logActivity(
            @PathVariable Long attemptId,
            @Valid @RequestBody LogActivityRequest request) {

        LogActivityResponse response = proctoringService.recordActivity(attemptId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/attempts/{attemptId}/activities/batch")
    public ResponseEntity<LogActivityResponse> logBatchActivities(
            @PathVariable Long attemptId,
            @Valid @RequestBody BatchLogActivityRequest request) {

        LogActivityResponse response = proctoringService.recordBatchActivities(attemptId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/attempts/{attemptId}/device")
    public ResponseEntity<ApiResponse> registerDevice(
            @PathVariable Long attemptId,
            @RequestBody RegisterDeviceRequest request) {

        proctoringService.registerDevice(attemptId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.ok("Device footprint registered successfully"));
    }

    @PostMapping("/attempts/{attemptId}/id-photo")
    public ResponseEntity<ApiResponse> uploadIdPhoto(
            @PathVariable Long attemptId,
            @RequestBody Map<String, String> body) {

        String idPhotoData = body != null ? body.get("idPhotoData") : null;
        proctoringService.saveIdPhoto(attemptId, idPhotoData);
        return ResponseEntity.ok(ApiResponse.ok("Candidate ID snapshot verified and recorded"));
    }

    // ─── Instructor / Teacher Endpoints ───────────────────────────────────────

    @GetMapping("/teacher/attempts/{attemptId}/proctoring-logs")
    public ResponseEntity<List<ActivityLogResponse>> getAttemptLogs(
            @PathVariable Long attemptId) {

        List<ActivityLogResponse> logs = proctoringService.getAttemptLogs(attemptId);
        return ResponseEntity.ok(logs);
    }

    @GetMapping("/teacher/attempts/{attemptId}/proctoring-summary")
    public ResponseEntity<ProctoringSummaryResponse> getAttemptSummary(
            @PathVariable Long attemptId) {

        ProctoringSummaryResponse summary = proctoringService.getAttemptSummary(attemptId);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/teacher/quizzes/{quizId}/proctoring-overview")
    public ResponseEntity<QuizProctoringOverviewResponse> getQuizProctoringOverview(
            @PathVariable Long quizId) {

        QuizProctoringOverviewResponse overview = proctoringService.getQuizProctoringOverview(quizId);
        return ResponseEntity.ok(overview);
    }
}
