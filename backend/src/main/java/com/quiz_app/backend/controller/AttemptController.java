package com.quiz_app.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SaveAnswerRequest;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
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
            @RequestBody StartAttemptRequest request) {

        AttemptResponse response = attemptService.startAttempt(quizCode, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PutMapping("/attempts/{attemptId}/answers/{questionId}")
    public ResponseEntity<AnswerResponse> saveAnswer(
            @PathVariable Long attemptId,
            @PathVariable Long questionId,
            @RequestBody SaveAnswerRequest request) {

        AnswerResponse response = attemptService.saveAnswer(
                attemptId,
                questionId,
                request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public ResponseEntity<SubmitAttemptResponse> submitAttempt(
            @PathVariable Long attemptId) {

        SubmitAttemptResponse response = attemptService.submitAttempt(attemptId);

        return ResponseEntity.ok(response);
    }
}