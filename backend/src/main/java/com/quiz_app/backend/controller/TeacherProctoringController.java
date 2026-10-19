package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.proctoring.TeacherProctoringReportResponse;
import com.quiz_app.backend.dto.proctoring.TeacherQuizProctoringOverviewResponse;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.ProctoringService;

@RestController
@RequestMapping("/api/v1/teacher/proctoring")
public class TeacherProctoringController {

    private final ProctoringService proctoringService;

    public TeacherProctoringController(ProctoringService proctoringService) {
        this.proctoringService = proctoringService;
    }

    @GetMapping("/quizzes/{quizCode}/report")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<TeacherQuizProctoringOverviewResponse> getQuizProctoringOverview(
            @PathVariable String quizCode,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        TeacherQuizProctoringOverviewResponse response = proctoringService.getQuizProctoringOverview(quizCode, userDetails.getId());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/attempts/{attemptId}")
    @PreAuthorize("hasRole('TEACHER')")
    public ResponseEntity<TeacherProctoringReportResponse> getAttemptProctoringReport(
            @PathVariable Long attemptId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        TeacherProctoringReportResponse response = proctoringService.getAttemptProctoringReport(attemptId, userDetails.getId());
        return ResponseEntity.ok(response);
    }
}
