package com.quiz_app.backend.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.AttemptService;
import com.quiz_app.backend.service.QuizService;

@RestController
@RequestMapping("/api/v1/teacher")
public class TeacherQuizController {

    private final AttemptService attemptService;
    private final QuizService quizService;

    public TeacherQuizController(
            AttemptService attemptService,
            QuizService quizService) {

        this.attemptService = attemptService;
        this.quizService = quizService;
    }

    @PutMapping("/quizzes/{quizId}/publish")
    public ResponseEntity<Void> publishQuiz(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        quizService.publishQuiz(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/quizzes/{quizId}/results/publish")
    public ResponseEntity<Void> publishResults(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        attemptService.publishResults(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/quizzes/{quizId}/results/unpublish")
    public ResponseEntity<Void> unpublishResults(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        attemptService.unpublishResults(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }
}