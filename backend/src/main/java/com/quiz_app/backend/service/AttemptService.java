package com.quiz_app.backend.service;

import java.time.LocalDateTime;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.transaction.Transactional;

@Service
public class AttemptService {

        private final QuizAttemptRepository quizAttemptRepository;
        private final QuizRepository quizRepository;
        private final UserRepository userRepository;

        public AttemptService(
                        QuizAttemptRepository quizAttemptRepository,
                        QuizRepository quizRepository,
                        UserRepository userRepository) {
                this.quizAttemptRepository = quizAttemptRepository;
                this.quizRepository = quizRepository;
                this.userRepository = userRepository;
        }

        @Transactional
        public AttemptResponse startAttempt(
                        Long quizId,
                        StartAttemptRequest request) {

                // 1. Find student
                User student = userRepository.findById(request.studentId())
                                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

                // 2. Verify student role
                if (!"STUDENT".equals(student.getRole().getName())) {
                        throw new BadRequestException(
                                        "Only a student can start a quiz");
                }

                // 3. Find quiz
                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                // 4. Check quiz status
                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "Quiz is not available");
                }

                LocalDateTime now = LocalDateTime.now();

                // 5. Check exam window
                if (quiz.getStartTime() != null &&
                                now.isBefore(quiz.getStartTime())) {

                        throw new BadRequestException(
                                        "Quiz has not started yet");
                }

                if (quiz.getEndTime() != null &&
                                now.isAfter(quiz.getEndTime())) {

                        throw new BadRequestException(
                                        "Quiz has already ended");
                }

                // 6. Prevent duplicate attempt
                if (quizAttemptRepository.existsByQuizIdAndStudentId(
                                quizId,
                                student.getId())) {

                        throw new ConflictException(
                                        "Student has already attempted this quiz");
                }

                // 7. Create attempt
                QuizAttempt attempt = new QuizAttempt();

                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStartedAt(now);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);

                attempt.setCurrentQuestion(1);
                attempt.setTotalTimeTaken(0);

                // Phase 2 fields — initial values only
                attempt.setWarningsCount(0);
                attempt.setRefreshCount(0);
                attempt.setReconnectCount(0);

                attempt.setFinalScore(java.math.BigDecimal.ZERO);
                attempt.setCreatedAt(now);

                attempt = quizAttemptRepository.save(attempt);

                // 8. Return safe response
                return new AttemptResponse(
                                attempt.getId(),
                                quiz.getId(),
                                student.getId(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt(),
                                attempt.getStatus(),
                                attempt.getCurrentQuestion(),
                                attempt.getTotalTimeTaken());
        }
}