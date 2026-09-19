package com.quiz_app.backend.controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.dto.quiz.UpdateQuizSettingsRequest;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.TeacherQuizService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;

@RestController
@RequestMapping("/api/v1/teacher")
public class TeacherQuizController {

    private final TeacherQuizService teacherQuizService;

    public TeacherQuizController(
            TeacherQuizService teacherQuizService) {

        this.teacherQuizService = teacherQuizService;
    }

    @PutMapping("/quizzes/{quizId}/publish")
    public ResponseEntity<Void> publishQuiz(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        teacherQuizService.publishQuiz(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/quizzes/{quizId}/results/publish")
    public ResponseEntity<Void> publishResults(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        teacherQuizService.publishResults(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/quizzes/{quizId}/results/unpublish")
    public ResponseEntity<Void> unpublishResults(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        teacherQuizService.unpublishResults(
                quizId,
                userDetails.getId());

        return ResponseEntity.noContent().build();
    }

    @GetMapping("/quizzes")
    public ResponseEntity<List<QuizResponse>> getTeacherQuizzes(
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        return ResponseEntity.ok(
                teacherQuizService.getTeacherQuizzes(
                        userDetails.getId()));
    }

    @PutMapping("/quizzes/{quizId}/settings")
    public ResponseEntity<QuizResponse> updateQuizSettings(
            @PathVariable Long quizId,
            @RequestBody UpdateQuizSettingsRequest request,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        QuizResponse response = teacherQuizService.updateQuizSettings(
                quizId,
                userDetails.getId(),
                request);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/quizzes/{quizId}/complete")
    public ResponseEntity<QuizResponse> completeQuiz(
            @PathVariable Long quizId,
            Authentication authentication) {

        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        QuizResponse response = teacherQuizService.completeQuiz(
                quizId,
                userDetails.getId());

        return ResponseEntity.ok(response);
    }
}