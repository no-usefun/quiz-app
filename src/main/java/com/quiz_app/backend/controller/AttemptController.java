package com.quiz_app.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.service.AttemptService;

@RestController
@RequestMapping("/api/v1")
public class AttemptController {

    private final AttemptService attemptService;

    public AttemptController(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @PostMapping("/quizzes/{quizId}/attempts")
    public ResponseEntity<AttemptResponse> startAttempt(
            @PathVariable Long quizId,
            @RequestBody StartAttemptRequest request) {

        AttemptResponse response = attemptService.startAttempt(quizId, request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}
