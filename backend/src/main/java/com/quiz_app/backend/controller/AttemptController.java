package com.quiz_app.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultDetailResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultResponse;
import com.quiz_app.backend.dto.attempt.LeaderboardEntryResponse;
import com.quiz_app.backend.dto.attempt.SaveAnswerRequest;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.AttemptService;

@RestController
@RequestMapping("/api/v1")
public class AttemptController {

    private final AttemptService attemptService;

    public AttemptController(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @PostMapping("/quizzes/{quizCode}/attempts")
    public ResponseEntity<AttemptResponse> startAttempt(
            @PathVariable String quizCode,
            @RequestBody StartAttemptRequest request,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        AttemptResponse response = attemptService.startAttempt(
                quizCode,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }

    @PutMapping("/attempts/{attemptId}/answers/{questionId}")
    public ResponseEntity<AnswerResponse> saveAnswer(
            @PathVariable Long attemptId,
            @PathVariable Long questionId,
            @RequestBody SaveAnswerRequest request,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        AnswerResponse response = attemptService.saveAnswer(
                attemptId,
                questionId,
                request,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public ResponseEntity<SubmitAttemptResponse> submitAttempt(
            @PathVariable Long attemptId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        SubmitAttemptResponse response = attemptService.submitAttempt(
                attemptId,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/attempts/{attemptId}/result")
    public ResponseEntity<AttemptResultResponse> getAttemptResult(
            @PathVariable Long attemptId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        AttemptResultResponse response = attemptService.getAttemptResult(
                attemptId,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/attempts/{attemptId}/result/details")
    public ResponseEntity<List<AttemptResultDetailResponse>> getAttemptResultDetails(
            @PathVariable Long attemptId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        List<AttemptResultDetailResponse> response = attemptService.getAttemptResultDetails(attemptId,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/quizzes/{quizId}/leaderboard")
    public ResponseEntity<List<LeaderboardEntryResponse>> getLeaderboard(
            @PathVariable Long quizId) {

        return ResponseEntity.ok(
                attemptService.getLeaderboard(quizId));
    }
}