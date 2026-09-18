package com.quiz_app.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SubmitAnswerRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.StudentAnswer;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.StudentAnswerRepository;
import com.quiz_app.backend.repository.StudentSelectedOptionRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class AttemptServiceTest {

        @Mock
        private QuizAttemptRepository quizAttemptRepository;

        @Mock
        private QuizRepository quizRepository;

        @Mock
        private UserRepository userRepository;

        @Mock
        private StudentAnswerRepository studentAnswerRepository;

        @Mock
        private StudentSelectedOptionRepository studentSelectedOptionRepository;

        @Mock
        private QuestionRepository questionRepository;

        @Mock
        private OptionRepository optionRepository;

        @InjectMocks
        private AttemptService attemptService;

        private User student;
        private User teacher;

        private Role studentRole;
        private Role teacherRole;

        private Quiz quiz;

        private Question mcqQuestion;

        private Option option1;
        private Option option2;

        private QuizAttempt attempt;

        private AttemptResponse attemptResponse;
        private AnswerResponse answerResponse;

        @BeforeEach
        void setUp() {

                // -------------------------------------------------
                // Roles
                // -------------------------------------------------

                studentRole = new Role();
                studentRole.setName("STUDENT");

                teacherRole = new Role();
                teacherRole.setName("TEACHER");

                // -------------------------------------------------
                // Student
                // -------------------------------------------------

                student = mock(User.class);

                when(student.getId()).thenReturn(1L);
                when(student.getRole()).thenReturn(studentRole);

                // -------------------------------------------------
                // Teacher
                // -------------------------------------------------

                teacher = mock(User.class);

                when(teacher.getId()).thenReturn(2L);
                when(teacher.getRole()).thenReturn(teacherRole);

                // -------------------------------------------------
                // Quiz
                // -------------------------------------------------

                quiz = mock(Quiz.class);

                when(quiz.getId()).thenReturn(10L);
                when(quiz.getQuizCode()).thenReturn("123456");
                when(quiz.getStatus()).thenReturn(QuizStatus.PUBLISHED);
                when(quiz.getStartTime()).thenReturn(null);
                when(quiz.getEndTime()).thenReturn(null);

                // -------------------------------------------------
                // Question
                // -------------------------------------------------

                mcqQuestion = mock(Question.class);

                when(mcqQuestion.getId()).thenReturn(100L);
                when(mcqQuestion.getQuiz()).thenReturn(quiz);
                when(mcqQuestion.getQuestionType()).thenReturn(QuestionType.MCQ);

                // -------------------------------------------------
                // Options
                // -------------------------------------------------

                option1 = mock(Option.class);

                when(option1.getId()).thenReturn(101L);
                when(option1.getQuestion()).thenReturn(mcqQuestion);

                option2 = mock(Option.class);

                when(option2.getId()).thenReturn(102L);
                when(option2.getQuestion()).thenReturn(mcqQuestion);

                // -------------------------------------------------
                // Attempt
                // -------------------------------------------------

                attempt = mock(QuizAttempt.class);

                when(attempt.getId()).thenReturn(1000L);
                when(attempt.getQuiz()).thenReturn(quiz);
                when(attempt.getStudent()).thenReturn(student);
                when(attempt.getStatus()).thenReturn(AttemptStatus.IN_PROGRESS);
                when(attempt.getCurrentQuestion()).thenReturn(1);
                when(attempt.getTotalTimeTaken()).thenReturn(0);
                when(attempt.getStartedAt())
                                .thenReturn(LocalDateTime.of(2026, 9, 18, 14, 0));
                when(attempt.getSubmittedAt()).thenReturn(null);

                // -------------------------------------------------
                // DTO responses
                // -------------------------------------------------

                attemptResponse = new AttemptResponse(
                                1000L,
                                10L,
                                1L,
                                LocalDateTime.of(2026, 9, 18, 14, 0),
                                null,
                                AttemptStatus.IN_PROGRESS,
                                1,
                                0);

                answerResponse = new AnswerResponse(
                                500L,
                                1000L,
                                100L,
                                List.of(101L),
                                15,
                                LocalDateTime.of(2026, 9, 18, 14, 0));
        }

        // =========================================================
        // START ATTEMPT
        // =========================================================

        @Test
        void startAttempt_shouldCreateAttemptSuccessfully() {
                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAttemptRepository
                                .existsByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(false);

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenReturn(attempt);

                AttemptResponse response = attemptService.startAttempt("123456", 1L);

                assertNotNull(response);
                assertEquals(1000L, response.attemptId());
                assertEquals(10L, response.quizId());
                assertEquals(1L, response.studentId());
                assertEquals(
                                AttemptStatus.IN_PROGRESS,
                                response.status());

                verify(quizAttemptRepository)
                                .save(any(QuizAttempt.class));
        }

        @Test
        void startAttempt_shouldRejectNullQuizCode() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt(null, 1L));

                verifyNoInteractions(quizRepository);
        }

        @Test
        void startAttempt_shouldRejectBlankQuizCode() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("   ", 1L));

                verifyNoInteractions(quizRepository);
        }

        @Test
        void startAttempt_shouldRejectNullStudentId() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", null));

                verifyNoInteractions(userRepository);
        }

        @Test
        void startAttempt_shouldRejectUnknownStudent() {
                when(userRepository.findById(999L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> attemptService.startAttempt("123456", 999L));
        }

        @Test
        void startAttempt_shouldRejectNonStudent() {
                when(userRepository.findById(2L))
                                .thenReturn(Optional.of(teacher));

                BadRequestException exception = assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 2L));

                assertEquals(
                                "Only a student can start a quiz",
                                exception.getMessage());
        }

        @Test
        void startAttempt_shouldRejectUnknownQuiz() {
                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldRejectUnpublishedQuiz() {
                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus())
                                .thenReturn(QuizStatus.DRAFT);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldRejectDuplicateAttempt() {
                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAttemptRepository
                                .existsByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(true);

                assertThrows(
                                ConflictException.class,
                                () -> attemptService.startAttempt("123456", 1L));

                verify(quizAttemptRepository, never())
                                .save(any(QuizAttempt.class));
        }

        @Test
        void submitAttempt_shouldSubmitSuccessfully() {

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                100L,
                                List.of(101L),
                                15);

                SubmitAttemptRequest request = new SubmitAttemptRequest(List.of(answer));

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository
                                .findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(mcqQuestion));

                when(optionRepository
                                .findById(101L))
                                .thenReturn(Optional.of(option1));

                when(studentAnswerRepository
                                .findByAttemptIdAndQuestionId(1000L, 100L))
                                .thenReturn(Optional.empty());

                when(studentAnswerRepository
                                .save(any(StudentAnswer.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                when(optionRepository
                                .findByQuestionIdAndCorrectTrue(100L))
                                .thenReturn(List.of(option1));

                when(studentAnswerRepository
                                .findByAttemptId(1000L))
                                .thenReturn(List.of());

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                request,
                                1L);

                assertNotNull(response);
        }

        @Test
        void submitAttempt_shouldRejectNullAttemptId() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                null,
                                                new SubmitAttemptRequest(List.of()),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectNullRequest() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                null,
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectNullStudentId() {
                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of()),
                                                null));
        }

        @Test
        void submitAttempt_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(attempt.getStudent().getId())
                                .thenReturn(2L);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of()),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectAlreadySubmittedAttempt() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(attempt.getStatus())
                                .thenReturn(AttemptStatus.SUBMITTED);

                assertThrows(
                                ConflictException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of()),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectDuplicateQuestions() {

                SubmitAnswerRequest a1 = new SubmitAnswerRequest(100L, List.of(101L), 10);

                SubmitAnswerRequest a2 = new SubmitAnswerRequest(100L, List.of(102L), 20);

                SubmitAttemptRequest request = new SubmitAttemptRequest(List.of(a1, a2));

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                request,
                                                1L));
        }

        @Test
        void submitAttempt_afterOverallTimer_shouldAutoSubmit() {
                when(attempt.getStartedAt())
                                .thenReturn(LocalDateTime.now().minusMinutes(31));

                when(quiz.getOverallTimerSeconds())
                                .thenReturn(1800);

                // configure normal submission dependencies...

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                new SubmitAttemptRequest(List.of()),
                                1L);

                assertEquals(
                                AttemptStatus.AUTO_SUBMITTED,
                                response.status());
        }

        @Test
        void submitAttempt_whenQuizEndsBeforeTimer_shouldAutoSubmit() {
                when(attempt.getStartedAt())
                                .thenReturn(LocalDateTime.now().minusMinutes(31));

                when(quiz.getOverallTimerSeconds())
                                .thenReturn(3600);

                when(quiz.getEndTime())
                                .thenReturn(LocalDateTime.now().minusMinutes(1));

                // configure finalization dependencies...

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                new SubmitAttemptRequest(List.of()),
                                1L);

                assertEquals(
                                AttemptStatus.AUTO_SUBMITTED,
                                response.status());
        }
}