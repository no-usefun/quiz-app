package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.service.AttemptService;

@RestController
@RequestMapping("/api/v1/teacher")
public class TeacherQuizController {

    private final AttemptService attemptService;

    public TeacherQuizController(AttemptService attemptService) {
        this.attemptService = attemptService;
    }

    @PutMapping("/quizzes/{quizId}/results/publish")
    public ResponseEntity<Void> publishResults(
            @PathVariable Long quizId) {

        attemptService.publishResults(quizId);

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/quizzes/{quizId}/results/unpublish")
    public ResponseEntity<Void> unpublishResults(
            @PathVariable Long quizId) {

        attemptService.unpublishResults(quizId);

        return ResponseEntity.noContent().build();
    }
}
