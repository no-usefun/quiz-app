package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.quiz_app.backend.dto.exam.OfflineExamStatusResponse;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.OfflineExamService;

@RestController
@RequestMapping("/api/v1/teacher/offline-exams")
public class OfflineExamController {
    private final OfflineExamService offlineExamService;

    public OfflineExamController(OfflineExamService offlineExamService) {
        this.offlineExamService = offlineExamService;
    }

    @PostMapping("/{quizId}/prepare")
    public ResponseEntity<OfflineExamStatusResponse> prepare(@PathVariable Long quizId, Authentication authentication) {
        return ResponseEntity.ok(offlineExamService.prepare(quizId, teacherId(authentication)));
    }

    @GetMapping("/{quizId}/status")
    public ResponseEntity<OfflineExamStatusResponse> status(@PathVariable Long quizId, Authentication authentication) {
        return ResponseEntity.ok(offlineExamService.status(quizId, teacherId(authentication)));
    }

    @PostMapping("/{quizId}/start")
    public ResponseEntity<OfflineExamStatusResponse> start(@PathVariable Long quizId, Authentication authentication) {
        return ResponseEntity.ok(offlineExamService.start(quizId, teacherId(authentication)));
    }

    @PostMapping("/{quizId}/end")
    public ResponseEntity<OfflineExamStatusResponse> end(@PathVariable Long quizId, Authentication authentication) {
        return ResponseEntity.ok(offlineExamService.end(quizId, teacherId(authentication)));
    }

    private Long teacherId(Authentication authentication) {
        return ((CustomUserDetails) authentication.getPrincipal()).getId();
    }
}
