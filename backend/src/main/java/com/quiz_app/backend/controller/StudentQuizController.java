package com.quiz_app.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultDetailResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultResponse;
import com.quiz_app.backend.dto.attempt.LeaderboardEntryResponse;
import com.quiz_app.backend.dto.attempt.StudentSubmissionResponse;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.QuizAvailabilityResponse;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.StudentAttemptService;
import com.quiz_app.backend.service.StudentQuizService;

@RestController
@RequestMapping("/api/v1/student")
public class StudentQuizController {
        private final StudentAttemptService studentAttemptService;
        private final StudentQuizService studentQuizService;

        public StudentQuizController(StudentAttemptService studentAttemptService,
                        StudentQuizService studentQuizService) {
                this.studentAttemptService = studentAttemptService;
                this.studentQuizService = studentQuizService;
        }

        @PostMapping("/quizzes/{quizCode}/attempts")
        public ResponseEntity<AttemptResponse> startAttempt(
                        @PathVariable String quizCode,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                AttemptResponse response = studentAttemptService.startAttempt(
                                quizCode,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @PostMapping("/attempts/{attemptId}/submit")
        public ResponseEntity<SubmitAttemptResponse> submitAttempt(
                        @PathVariable Long attemptId,
                        @RequestBody SubmitAttemptRequest request,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                SubmitAttemptResponse response = studentAttemptService.submitAttempt(
                                attemptId,
                                request,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @GetMapping("/attempts/{attemptId}/result")
        public ResponseEntity<AttemptResultResponse> getAttemptResult(
                        @PathVariable Long attemptId,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                AttemptResultResponse response = studentAttemptService.getAttemptResult(
                                attemptId,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @GetMapping("/attempts/{attemptId}/result/details")
        public ResponseEntity<List<AttemptResultDetailResponse>> getAttemptResultDetails(
                        @PathVariable Long attemptId,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                List<AttemptResultDetailResponse> response = studentAttemptService.getAttemptResultDetails(attemptId,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @GetMapping("/quizzes/{quizId}/leaderboard")
        public ResponseEntity<List<LeaderboardEntryResponse>> getLeaderboard(
                        @PathVariable Long quizId, Authentication authentication) {
                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
                return ResponseEntity.ok(
                                studentAttemptService.getLeaderboard(quizId,
                                                userDetails.getId()));
        }

        @GetMapping("/submissions")
        public ResponseEntity<List<StudentSubmissionResponse>> getStudentSubmissions(
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                return ResponseEntity.ok(
                                studentAttemptService.getStudentSubmissions(
                                                userDetails.getId()));
        }

        @GetMapping("/quizzes/{quizCode}/availability")
        public ResponseEntity<QuizAvailabilityResponse> getQuizAvailability(
                        @PathVariable String quizCode,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                QuizAvailabilityResponse response = studentAttemptService.getQuizAvailability(
                                quizCode,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @PostMapping("/attempts/{attemptId}/auto-submit")
        public ResponseEntity<SubmitAttemptResponse> autoSubmitAttempt(
                        @PathVariable Long attemptId,
                        Authentication authentication) {

                CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

                SubmitAttemptResponse response = studentAttemptService.autoSubmitAttempt(
                                attemptId,
                                userDetails.getId());

                return ResponseEntity.ok(response);
        }

        @GetMapping("/quizzes/{quizId}/package")
        public ResponseEntity<QuizPackageResponse> getQuizPackage(
                        @PathVariable Long quizId) {
                QuizPackageResponse response = studentQuizService.getQuizPackage(quizId);

                return ResponseEntity.ok(response);
        }

        @GetMapping("/quizzes/code/{quizCode}/package")
        public ResponseEntity<QuizPackageResponse> getQuizPackageByCode(
                        @PathVariable String quizCode) {
                return ResponseEntity.ok(
                                studentQuizService.getQuizPackageByCode(quizCode));
        }
}
