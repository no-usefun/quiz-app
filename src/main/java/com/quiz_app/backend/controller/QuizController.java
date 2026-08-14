package com.quiz_app.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.service.QuizService;

@RestController
@RequestMapping("/api/v1")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping("/teacher/quizzes")
    public ResponseEntity<QuizResponse> createQuiz(
            @RequestBody CreateQuizRequest request) {
        QuizResponse quiz = quizService.createQuiz(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(quiz);
    }

    @GetMapping("/quizzes/{quizId}/package")
    public ResponseEntity<QuizPackageResponse> getQuizPackage(
            @PathVariable Long quizId) {
        QuizPackageResponse response = quizService.getQuizPackage(quizId);

        return ResponseEntity.ok(response);
    }
}