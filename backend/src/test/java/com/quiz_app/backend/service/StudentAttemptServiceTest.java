package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultDetailResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultResponse;
import com.quiz_app.backend.dto.attempt.LeaderboardEntryResponse;
import com.quiz_app.backend.dto.attempt.StudentSubmissionResponse;
import com.quiz_app.backend.dto.attempt.SubmitAnswerRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.dto.quiz.QuizAvailabilityResponse;
import com.quiz_app.backend.entity.AnswerStatus;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizAvailabilityStatus;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.StudentAnswer;
import com.quiz_app.backend.entity.StudentSelectedOption;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.AccessDeniedApplicationException;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.StudentAnswerRepository;
import com.quiz_app.backend.repository.StudentSelectedOptionRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class StudentAttemptServiceTest {

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

        @Mock
        private QuizAllowedStudentRepository quizAllowedStudentRepository;

        @Mock
        private Clock clock;

        @InjectMocks
        private StudentAttemptService attemptService;

        private User student;
        private User teacher;

        private Role studentRole;
        private Role teacherRole;

        private Quiz quiz;
        private Question question;
        private Option option1;
        private Option option2;

        private QuizAttempt attempt;

        private LocalDateTime startedAt;

        @BeforeEach
        void setUp() {

                startedAt = LocalDateTime.now().minusMinutes(5);

                Clock fixedClock = Clock.fixed(
                                Instant.parse("2026-09-21T15:00:00Z"),
                                ZoneId.of("Asia/Kolkata"));
                lenient().when(clock.withZone(any(ZoneId.class))).thenReturn(fixedClock);

                // ---------------------------------------------------------
                // Roles
                // ---------------------------------------------------------

                studentRole = new Role();
                studentRole.setName("STUDENT");

                teacherRole = new Role();
                teacherRole.setName("TEACHER");

                // ---------------------------------------------------------
                // Student
                // ---------------------------------------------------------

                student = new User();

                setUserId(student, 1L);
                student.setRole(studentRole);
                student.setFirstName("Harsh");
                student.setLastName("Agarwal");
                student.setEmail("harsh@example.com");
                student.setRegistrationNo("22BCE0001");

                // ---------------------------------------------------------
                // Teacher
                // ---------------------------------------------------------

                teacher = new User();

                setUserId(teacher, 2L);
                teacher.setRole(teacherRole);
                teacher.setFirstName("Teacher");
                teacher.setLastName("User");
                teacher.setEmail("teacher@example.com");

                // ---------------------------------------------------------
                // Quiz
                // ---------------------------------------------------------

                quiz = new Quiz();

                setQuizId(quiz, 10L);
                quiz.setQuizCode("123456");
                quiz.setStatus(QuizStatus.PUBLISHED);
                quiz.setTitle("Java Test");
                quiz.setTotalMarks(BigDecimal.TEN);
                quiz.setOverallTimerSeconds(1800);
                quiz.setNegativeMarking(false);
                quiz.setNegativeMarks(BigDecimal.ONE);
                quiz.setResultsPublished(true);
                quiz.setResultVisibility(ResultVisibility.BOTH);

                // ---------------------------------------------------------
                // Question
                // ---------------------------------------------------------

                question = new Question();

                setQuestionId(question, 100L);
                question.setQuiz(quiz);
                question.setQuestionText("What is Java?");
                question.setQuestionType(QuestionType.MCQ);
                question.setMarks(BigDecimal.TEN);
                question.setNegativeMarks(BigDecimal.ONE);
                question.setDisplayOrder(1);

                // ---------------------------------------------------------
                // Options
                // ---------------------------------------------------------

                option1 = new Option();

                setOptionId(option1, 101L);
                option1.setQuestion(question);
                option1.setOptionText("Programming language");
                option1.setCorrect(true);

                option2 = new Option();

                setOptionId(option2, 102L);
                option2.setQuestion(question);
                option2.setOptionText("Database");
                option2.setCorrect(false);

                // ---------------------------------------------------------
                // Attempt
                // ---------------------------------------------------------

                attempt = new QuizAttempt();

                setAttemptId(attempt, 1000L);
                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStartedAt(startedAt);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);
                attempt.setCurrentQuestion(1);
                attempt.setTotalTimeTaken(0);
                attempt.setFinalScore(BigDecimal.ZERO);
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

                when(quizAllowedStudentRepository
                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                10L,
                                                "22BCE0001"))
                                .thenReturn(false);

                when(quizAllowedStudentRepository.existsByQuizId(10L))
                                .thenReturn(false);

                when(quizAttemptRepository
                                .findByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(Optional.empty());

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                AttemptResponse response = attemptService.startAttempt("123456", 1L);

                assertNotNull(response);
                assertEquals(10L, response.quizId());
                assertEquals(1L, response.studentId());
                assertEquals(AttemptStatus.IN_PROGRESS, response.status());
                assertEquals(1, response.currentQuestion());
                assertEquals(0, response.totalTimeTaken());

                ArgumentCaptor<QuizAttempt> captor = ArgumentCaptor.forClass(QuizAttempt.class);

                verify(quizAttemptRepository).save(captor.capture());

                QuizAttempt saved = captor.getValue();

                assertEquals(quiz, saved.getQuiz());
                assertEquals(student, saved.getStudent());
                assertEquals(AttemptStatus.IN_PROGRESS, saved.getStatus());
                assertEquals(1, saved.getCurrentQuestion());
                assertEquals(0, saved.getTotalTimeTaken());
                assertEquals(BigDecimal.ZERO, saved.getFinalScore());
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

                verifyNoInteractions(quizRepository);
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

                quiz.setStatus(QuizStatus.DRAFT);

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldRejectQuizThatHasNotStarted() {

                quiz.setStartTime(LocalDateTime.now().plusMinutes(10));

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldRejectQuizThatHasEnded() {

                quiz.setEndTime(LocalDateTime.now().minusMinutes(1));

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldRejectStudentOutsideAcceptedEmailDomain() {

                quiz.setAcceptedEmailDomain("@vitap.ac.in");

                student.setEmail("student@gmail.com");

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));
        }

        @Test
        void startAttempt_shouldAcceptStudentInsideAcceptedEmailDomain() {

                quiz.setAcceptedEmailDomain("@vitap.ac.in");

                student.setEmail("student@vitap.ac.in");

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAllowedStudentRepository
                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                10L,
                                                "22BCE0001"))
                                .thenReturn(false);

                when(quizAllowedStudentRepository.existsByQuizId(10L))
                                .thenReturn(false);

                when(quizAttemptRepository
                                .findByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(Optional.empty());

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                AttemptResponse response = attemptService.startAttempt("123456", 1L);

                assertNotNull(response);
        }

        @Test
        void startAttempt_shouldRejectStudentNotInRegistrationWhitelist() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAllowedStudentRepository
                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                10L,
                                                "22BCE0001"))
                                .thenReturn(false);

                when(quizAllowedStudentRepository.existsByQuizId(10L))
                                .thenReturn(true);

                BadRequestException exception = assertThrows(
                                BadRequestException.class,
                                () -> attemptService.startAttempt("123456", 1L));

                assertEquals(
                                "Student registration number is not allowed for this quiz",
                                exception.getMessage());

                verify(quizAttemptRepository, never())
                                .save(any(QuizAttempt.class));
        }

        @Test
        void startAttempt_shouldAllowStudentExplicitlyWhitelisted() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAllowedStudentRepository
                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                10L,
                                                "22BCE0001"))
                                .thenReturn(true);

                when(quizAttemptRepository
                                .findByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(Optional.empty());

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                AttemptResponse response = attemptService.startAttempt("123456", 1L);

                assertNotNull(response);

                verify(quizAllowedStudentRepository, never())
                                .existsByQuizId(10L);
        }

        @Test
        void startAttempt_shouldRejectDuplicateAttempt() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                when(quizAllowedStudentRepository
                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                10L,
                                                "22BCE0001"))
                                .thenReturn(false);

                when(quizAllowedStudentRepository.existsByQuizId(10L))
                                .thenReturn(false);

                attempt.setStatus(AttemptStatus.SUBMITTED);

                when(quizAttemptRepository
                                .findByQuizQuizCodeAndStudentId("123456", 1L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                ConflictException.class,
                                () -> attemptService.startAttempt("123456", 1L));

                verify(quizAttemptRepository, never())
                                .save(any(QuizAttempt.class));
        }

        // =========================================================
        // AUTO SUBMIT
        // =========================================================

        @Test
        void autoSubmitAttempt_shouldRejectNullAttemptId() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.autoSubmitAttempt(null, 1L));

                verifyNoInteractions(quizAttemptRepository);
        }

        @Test
        void autoSubmitAttempt_shouldRejectUnknownAttempt() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizAttemptRepository.findById(999L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                AccessDeniedApplicationException.class,
                                () -> attemptService.autoSubmitAttempt(999L, 1L));
        }

        @Test
        void autoSubmitAttempt_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                AccessDeniedApplicationException.class,
                                () -> attemptService.autoSubmitAttempt(1000L, 999L));

                verify(quizAttemptRepository, never())
                                .save(any(QuizAttempt.class));
        }

        @Test
        void autoSubmitAttempt_shouldFinalizeAttempt() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());

                stubStudentAnswerSaveWithId(500L);

                when(studentSelectedOptionRepository.findByAnswerId(anyLong()))
                                .thenReturn(List.of());

                when(optionRepository.findByQuestionIdAndCorrectTrue(100L))
                                .thenReturn(List.of(option1));

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                SubmitAttemptResponse response = attemptService.autoSubmitAttempt(1000L, 1L);

                assertNotNull(response);
                assertEquals(
                                AttemptStatus.AUTO_SUBMITTED,
                                response.status());

                verify(quizAttemptRepository)
                                .save(attempt);
        }

        // =========================================================
        // SUBMIT ATTEMPT
        // =========================================================

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
        void submitAttempt_shouldRejectUnknownAttempt() {

                when(quizAttemptRepository.findById(999L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                AccessDeniedApplicationException.class,
                                () -> attemptService.submitAttempt(
                                                999L,
                                                new SubmitAttemptRequest(List.of()),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of()),
                                                999L));
        }

        @Test
        void submitAttempt_shouldRejectAlreadySubmittedAttempt() {

                attempt.setStatus(AttemptStatus.SUBMITTED);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                ConflictException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of()),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectDuplicateQuestionIds() {

                SubmitAnswerRequest first = new SubmitAnswerRequest(
                                100L,
                                List.of(101L),
                                10);

                SubmitAnswerRequest second = new SubmitAnswerRequest(
                                100L,
                                List.of(102L),
                                10);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(
                                                                List.of(first, second)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectQuestionNotBelongingToQuiz() {

                Question otherQuestion = new Question();

                setQuestionId(otherQuestion, 999L);
                otherQuestion.setQuiz(quiz);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                999L,
                                List.of(),
                                10);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of(answer)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectNegativeResponseTime() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                100L,
                                List.of(),
                                -1);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of(answer)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectUnknownSelectedOption() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findById(999L))
                                .thenReturn(Optional.empty());

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                100L,
                                List.of(999L),
                                10);

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of(answer)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectOptionFromDifferentQuestion() {

                Question otherQuestion = new Question();

                setQuestionId(otherQuestion, 200L);
                otherQuestion.setQuestionType(QuestionType.MCQ);

                Option wrongOption = new Option();

                setOptionId(wrongOption, 201L);
                wrongOption.setQuestion(otherQuestion);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findById(201L))
                                .thenReturn(Optional.of(wrongOption));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                100L,
                                List.of(201L),
                                10);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of(answer)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldRejectMultipleOptionsForMcq() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findById(101L))
                                .thenReturn(Optional.of(option1));

                when(optionRepository.findById(102L))
                                .thenReturn(Optional.of(option2));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                100L,
                                List.of(101L, 102L),
                                10);

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.submitAttempt(
                                                1000L,
                                                new SubmitAttemptRequest(List.of(answer)),
                                                1L));
        }

        @Test
        void submitAttempt_shouldScoreCorrectAnswer() {
                setAttemptId(attempt, 100L);
                setQuizId(quiz, 10L);
                setUserId(student, 1L);

                quiz.setStatus(QuizStatus.PUBLISHED);
                quiz.setTotalMarks(BigDecimal.TEN);
                quiz.setNegativeMarking(false);

                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);
                attempt.setStartedAt(LocalDateTime.now().minusSeconds(5));

                question.setQuiz(quiz);
                question.setMarks(BigDecimal.TEN);
                question.setNegativeMarks(BigDecimal.ZERO);
                setQuestionId(question, 20L);

                // Correct option
                Option correctOption = new Option();
                setOptionId(correctOption, 101L);
                correctOption.setQuestion(question);
                correctOption.setCorrect(true);

                // This is what the service actually reads during scoring
                StudentSelectedOption selectedOption = new StudentSelectedOption();
                selectedOption.setOption(correctOption);

                when(quizAttemptRepository.findById(100L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdAndCorrectTrue(20L))
                                .thenReturn(List.of(correctOption));

                when(studentAnswerRepository.findByAttemptIdAndQuestionId(100L, 20L))
                                .thenReturn(Optional.empty());

                when(optionRepository.findById(101L))
                                .thenReturn(Optional.of(correctOption));

                stubStudentAnswerSaveWithId(500L);

                // Selected option must contain the correct option
                when(studentSelectedOptionRepository.findByAnswerId(500L))
                                .thenReturn(List.of(selectedOption));

                when(studentAnswerRepository.findByAttemptId(100L))
                                .thenReturn(List.of());

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                20L,
                                List.of(101L),
                                5);

                SubmitAttemptRequest request = new SubmitAttemptRequest(List.of(answer));

                SubmitAttemptResponse response = attemptService.submitAttempt(100L, request, 1L);

                assertEquals(BigDecimal.TEN, response.finalScore());
        }

        @Test
        void submitAttempt_shouldApplyNegativeMarkingForWrongAnswer() {
                setAttemptId(attempt, 100L);
                setQuizId(quiz, 10L);
                setUserId(student, 1L);

                quiz.setStatus(QuizStatus.PUBLISHED);
                quiz.setTotalMarks(BigDecimal.TEN);
                quiz.setNegativeMarking(true);

                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);
                attempt.setStartedAt(LocalDateTime.now().minusSeconds(5));

                question.setQuiz(quiz);
                question.setMarks(BigDecimal.TEN);
                question.setNegativeMarks(BigDecimal.ONE);
                setQuestionId(question, 20L);

                // Correct option
                Option correctOption = new Option();
                setOptionId(correctOption, 101L);
                correctOption.setQuestion(question);
                correctOption.setCorrect(true);

                // Wrong option
                Option wrongOption = new Option();
                setOptionId(wrongOption, 102L);
                wrongOption.setQuestion(question);
                wrongOption.setCorrect(false);

                // Student selected the WRONG option
                StudentSelectedOption selectedOption = new StudentSelectedOption();
                selectedOption.setOption(wrongOption);

                when(quizAttemptRepository.findById(100L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                // Service uses this to determine the correct answer
                when(optionRepository.findByQuestionIdAndCorrectTrue(20L))
                                .thenReturn(List.of(correctOption));

                when(studentAnswerRepository.findByAttemptIdAndQuestionId(100L, 20L))
                                .thenReturn(Optional.empty());

                stubStudentAnswerSaveWithId(500L);

                // Service uses this to determine what the student selected
                when(studentSelectedOptionRepository.findByAnswerId(500L))
                                .thenReturn(List.of(selectedOption));

                when(studentAnswerRepository.findByAttemptId(100L))
                                .thenReturn(List.of());

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                when(optionRepository.findById(102L))
                                .thenReturn(Optional.of(wrongOption));

                SubmitAnswerRequest answer = new SubmitAnswerRequest(
                                20L,
                                List.of(102L),
                                5);

                SubmitAttemptRequest request = new SubmitAttemptRequest(List.of(answer));

                SubmitAttemptResponse response = attemptService.submitAttempt(100L, request, 1L);

                assertEquals(BigDecimal.ONE.negate(), response.finalScore());
        }

        @Test
        void submitAttempt_shouldCreateUnansweredRecordsForMissingQuestions() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());

                stubStudentAnswerSaveWithId(500L);

                when(studentSelectedOptionRepository.findByAnswerId(anyLong()))
                                .thenReturn(List.of());

                when(optionRepository.findByQuestionIdAndCorrectTrue(100L))
                                .thenReturn(List.of(option1));

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                new SubmitAttemptRequest(List.of()),
                                1L);

                assertEquals(
                                AttemptStatus.SUBMITTED,
                                response.status());

                assertEquals(
                                BigDecimal.ZERO,
                                response.finalScore());

                ArgumentCaptor<StudentAnswer> answerCaptor = ArgumentCaptor.forClass(StudentAnswer.class);

                verify(studentAnswerRepository, atLeastOnce())
                                .save(answerCaptor.capture());

                StudentAnswer saved = answerCaptor.getAllValues().get(0);

                assertEquals(
                                AnswerStatus.UNANSWERED,
                                saved.getAnswerStatus());

                assertFalse(saved.isCorrect());
                assertEquals(BigDecimal.ZERO, saved.getMarksAwarded());
        }

        @Test
        void submitAttempt_shouldAutoSubmitWhenOverallTimerExpires() {

                attempt.setStartedAt(
                                LocalDateTime.now().minusMinutes(31));

                quiz.setOverallTimerSeconds(1800);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());

                stubStudentAnswerSaveWithId(500L);

                when(studentSelectedOptionRepository.findByAnswerId(anyLong()))
                                .thenReturn(List.of());

                when(optionRepository.findByQuestionIdAndCorrectTrue(100L))
                                .thenReturn(List.of(option1));

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                new SubmitAttemptRequest(List.of()),
                                1L);

                assertEquals(
                                AttemptStatus.AUTO_SUBMITTED,
                                response.status());
        }

        @Test
        void submitAttempt_shouldAutoSubmitWhenQuizEndTimeExpiresFirst() {

                attempt.setStartedAt(
                                LocalDateTime.now().minusMinutes(10));

                quiz.setOverallTimerSeconds(3600);
                quiz.setEndTime(
                                LocalDateTime.now().minusMinutes(1));

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());

                stubStudentAnswerSaveWithId(500L);

                when(studentSelectedOptionRepository.findByAnswerId(anyLong()))
                                .thenReturn(List.of());

                when(optionRepository.findByQuestionIdAndCorrectTrue(100L))
                                .thenReturn(List.of(option1));

                when(quizAttemptRepository.save(any(QuizAttempt.class)))
                                .thenAnswer(invocation -> invocation.getArgument(0));

                SubmitAttemptResponse response = attemptService.submitAttempt(
                                1000L,
                                new SubmitAttemptRequest(List.of()),
                                1L);

                assertEquals(
                                AttemptStatus.AUTO_SUBMITTED,
                                response.status());
        }

        // =========================================================
        // GET RESULT
        // =========================================================

        @Test
        void getAttemptResult_shouldReturnResultSuccessfully() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setFinalScore(new BigDecimal("8.00"));
                attempt.setTotalTimeTaken(120);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                AttemptResultResponse response = attemptService.getAttemptResult(1000L, 1L);

                assertNotNull(response);
                assertEquals(1000L, response.attemptId());
                assertEquals(10L, response.quizId());
                assertEquals("Java Test", response.quizTitle());
                assertEquals(1L, response.studentId());
                assertEquals(AttemptStatus.SUBMITTED, response.status());
                assertEquals(new BigDecimal("8.00"), response.finalScore());
                assertEquals(BigDecimal.TEN, response.totalMarks());
                assertEquals(new BigDecimal("80.00"), response.percentage());
                assertEquals(120, response.totalTimeTaken());
        }

        @Test
        void getAttemptResult_shouldRejectNullAttemptId() {

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(null, 1L));
        }

        @Test
        void getAttemptResult_shouldRejectUnknownAttempt() {

                when(quizAttemptRepository.findById(999L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                AccessDeniedApplicationException.class,
                                () -> attemptService.getAttemptResult(999L, 1L));
        }

        @Test
        void getAttemptResult_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(1000L, 999L));
        }

        @Test
        void getAttemptResult_shouldRejectInProgressAttempt() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(1000L, 1L));
        }

        @Test
        void getAttemptResult_shouldRejectUnpublishedResults() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                quiz.setResultsPublished(false);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(1000L, 1L));
        }

        // =========================================================
        // RESULT DETAILS
        // =========================================================

        @Test
        void getAttemptResultDetails_shouldReturnQuestionWiseResults() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setFinalScore(BigDecimal.TEN);

                StudentAnswer answer = new StudentAnswer();

                setStudentAnswerId(answer, 500L);
                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setAnswerStatus(AnswerStatus.ANSWERED);
                answer.setCorrect(true);
                answer.setMarksAwarded(BigDecimal.TEN);
                answer.setResponseTimeSeconds(15);

                StudentSelectedOption selected = mock(StudentSelectedOption.class);

                when(selected.getOption())
                                .thenReturn(option1);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of(answer));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(studentSelectedOptionRepository.findByAnswerId(500L))
                                .thenReturn(List.of(selected));

                List<AttemptResultDetailResponse> result = attemptService.getAttemptResultDetails(
                                1000L,
                                1L);

                assertNotNull(result);
                assertEquals(1, result.size());

                AttemptResultDetailResponse detail = result.get(0);

                assertEquals(100L, detail.questionId());
                assertEquals("What is Java?", detail.questionText());
                assertEquals(1, detail.displayOrder());
                assertEquals(List.of(101L), detail.selectedOptionIds());
                assertEquals(List.of(101L), detail.correctOptionIds());
                assertEquals(AnswerStatus.ANSWERED, detail.answerStatus());
                assertTrue(detail.correct());
                assertEquals(BigDecimal.TEN, detail.marksAwarded());
                assertEquals(BigDecimal.TEN, detail.questionMarks());
                assertEquals(15, detail.responseTimeSeconds());
        }

        @Test
        void getAttemptResultDetails_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResultDetails(1000L, 999L));
        }

        @Test
        void getAttemptResultDetails_shouldRejectWhenQuestionWiseResultsUnavailable() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                quiz.setResultVisibility(ResultVisibility.LEADERBOARD);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResultDetails(
                                                1000L,
                                                1L));
        }

        @Test
        void getAttemptResultDetails_shouldCreateUnansweredDetailWhenAnswerMissing() {

                attempt.setStatus(AttemptStatus.SUBMITTED);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                List<AttemptResultDetailResponse> result = attemptService.getAttemptResultDetails(
                                1000L,
                                1L);

                assertEquals(1, result.size());

                AttemptResultDetailResponse detail = result.get(0);

                assertEquals(
                                AnswerStatus.UNANSWERED,
                                detail.answerStatus());

                assertFalse(detail.correct());
                assertEquals(
                                List.of(101L),
                                detail.correctOptionIds());
                assertTrue(detail.selectedOptionIds().isEmpty());
                assertNull(detail.responseTimeSeconds());
        }

        // =========================================================
        // QUIZ AVAILABILITY
        // =========================================================

        @Test
        void getQuizAvailability_shouldReturnNotFound() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("999999"))
                                .thenReturn(Optional.empty());

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("999999", 1L);

                assertFalse(response.available());
                assertEquals(QuizAvailabilityStatus.NOT_FOUND, response.status());
                assertEquals("999999", response.quizCode());
                assertNull(response.startTime());
                assertNull(response.endTime());
        }

        @Test
        void getQuizAvailability_shouldReturnNotPublished() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setStatus(QuizStatus.DRAFT);

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("123456", 1L);

                assertFalse(response.available());
                assertEquals(QuizAvailabilityStatus.NOT_PUBLISHED, response.status());
        }

        @Test
        void getQuizAvailability_shouldReturnNotStarted() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setStartTime(LocalDateTime.of(2026, 9, 21, 21, 0));
                quiz.setEndTime(LocalDateTime.of(2026, 9, 21, 22, 0));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("123456", 1L);

                assertFalse(response.available());
                assertEquals(QuizAvailabilityStatus.NOT_STARTED, response.status());
        }

        @Test
        void getQuizAvailability_shouldReturnLiveAtExactStartTime() {

                quiz.setStartTime(LocalDateTime.of(2026, 9, 21, 20, 30));
                quiz.setEndTime(LocalDateTime.of(2026, 9, 21, 21, 30));

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("123456", 1L);

                assertTrue(response.available());
                assertEquals(QuizAvailabilityStatus.LIVE, response.status());
        }

        @Test
        void getQuizAvailability_shouldReturnLive() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setStartTime(LocalDateTime.of(2026, 9, 21, 19, 0));
                quiz.setEndTime(LocalDateTime.of(2026, 9, 21, 21, 0));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("123456", 1L);

                assertTrue(response.available());
                assertEquals(QuizAvailabilityStatus.LIVE, response.status());
        }

        @Test
        void getQuizAvailability_shouldReturnEndedAtExactEndTime() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setStartTime(LocalDateTime.of(2026, 9, 21, 19, 0));
                quiz.setEndTime(LocalDateTime.of(2026, 9, 21, 20, 30));

                when(quizRepository.findByQuizCode("123456"))
                                .thenReturn(Optional.of(quiz));

                QuizAvailabilityResponse response = attemptService.getQuizAvailability("123456", 1L);

                assertFalse(response.available());
                assertEquals(QuizAvailabilityStatus.ENDED, response.status());
        }

        @Test
        void getQuizAvailability_shouldRejectNullStudentId() {

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getQuizAvailability("123456", null));
        }

        // =========================================================
        // LEADERBOARD
        // =========================================================

        @Test
        void getLeaderboard_shouldReturnSubmittedAttemptsSortedByScore() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                QuizAttempt first = createLeaderboardAttempt(
                                1001L,
                                1L,
                                "Harsh",
                                "Agarwal",
                                AttemptStatus.SUBMITTED,
                                new BigDecimal("9.00"),
                                100);

                QuizAttempt second = createLeaderboardAttempt(
                                1002L,
                                2L,
                                "Student",
                                "Two",
                                AttemptStatus.SUBMITTED,
                                new BigDecimal("7.00"),
                                150);

                QuizAttempt inProgress = createLeaderboardAttempt(
                                1003L,
                                3L,
                                "Student",
                                "Three",
                                AttemptStatus.IN_PROGRESS,
                                new BigDecimal("10.00"),
                                50);

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quizAttemptRepository.findByQuizId(10L))
                                .thenReturn(List.of(
                                                second,
                                                inProgress,
                                                first));

                List<LeaderboardEntryResponse> result = attemptService.getLeaderboard(10L, 1L);

                assertEquals(2, result.size());

                assertEquals(1, result.get(0).rank());
                assertEquals(1L, result.get(0).studentId());
                assertEquals(new BigDecimal("9.00"), result.get(0).score());

                assertEquals(2, result.get(1).rank());
                assertEquals(2L, result.get(1).studentId());
                assertEquals(new BigDecimal("7.00"), result.get(1).score());
        }

        @Test
        void getLeaderboard_shouldRejectNullQuizId() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getLeaderboard(null, 1L));
        }

        @Test
        void getLeaderboard_shouldRejectUnknownQuiz() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                when(quizRepository.findById(999L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> attemptService.getLeaderboard(999L, 1L));
        }

        @Test
        void getLeaderboard_shouldRejectUnpublishedResults() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setResultsPublished(false);

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getLeaderboard(10L, 1L));
        }

        @Test
        void getLeaderboard_shouldRejectUnavailableVisibility() {

                when(userRepository.findById(1L))
                                .thenReturn(Optional.of(student));

                quiz.setResultVisibility(ResultVisibility.QUESTION_WISE);

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getLeaderboard(10L, 1L));
        }

        // =========================================================
        // STUDENT SUBMISSIONS
        // =========================================================

        @Test
        void getStudentSubmissions_shouldRejectNullStudentId() {

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getStudentSubmissions(null));

                verifyNoInteractions(quizAttemptRepository);
        }

        @Test
        void getStudentSubmissions_shouldReturnPublishedResults() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setFinalScore(new BigDecimal("8.00"));
                attempt.setTotalTimeTaken(120);
                attempt.setSubmittedAt(LocalDateTime.now());

                when(quizAttemptRepository
                                .findByStudentIdAndStatusInOrderBySubmittedAtDesc(
                                                eq(1L),
                                                anyList()))
                                .thenReturn(List.of(attempt));

                List<StudentSubmissionResponse> result = attemptService.getStudentSubmissions(1L);

                assertEquals(1, result.size());

                StudentSubmissionResponse response = result.get(0);

                assertEquals(1000L, response.attemptId());
                assertEquals(10L, response.quizId());
                assertEquals("Java Test", response.quizTitle());
                assertEquals(AttemptStatus.SUBMITTED, response.status());
                assertEquals(new BigDecimal("8.00"), response.finalScore());
                assertEquals(BigDecimal.TEN, response.totalMarks());
                assertEquals(new BigDecimal("80.00"), response.percentage());
                assertTrue(response.resultsAvailable());
        }

        @Test
        void getStudentSubmissions_shouldHideResultsWhenNotPublished() {

                quiz.setResultsPublished(false);

                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setFinalScore(new BigDecimal("8.00"));

                when(quizAttemptRepository
                                .findByStudentIdAndStatusInOrderBySubmittedAtDesc(
                                                eq(1L),
                                                anyList()))
                                .thenReturn(List.of(attempt));

                List<StudentSubmissionResponse> result = attemptService.getStudentSubmissions(1L);

                assertEquals(1, result.size());

                StudentSubmissionResponse response = result.get(0);

                assertFalse(response.resultsAvailable());
                assertNull(response.finalScore());
                assertNull(response.totalMarks());
                assertNull(response.percentage());
        }

        // =========================================================
        // TEST HELPERS
        // =========================================================

        private QuizAttempt createLeaderboardAttempt(
                        Long attemptId,
                        Long studentId,
                        String firstName,
                        String lastName,
                        AttemptStatus status,
                        BigDecimal score,
                        Integer timeTaken) {

                User user = new User();

                setUserId(user, studentId);
                user.setFirstName(firstName);
                user.setLastName(lastName);

                QuizAttempt result = new QuizAttempt();

                setAttemptId(result, attemptId);

                result.setStudent(user);
                result.setQuiz(quiz);
                result.setStatus(status);
                result.setFinalScore(score);
                result.setTotalTimeTaken(timeTaken);

                return result;
        }

        /*
         * The entity IDs do not have public setters.
         * These helpers use reflection only to give test fixtures stable IDs.
         */
        private void setUserId(User user, Long id) {
                setField(user, "id", id);
        }

        private void setQuizId(Quiz quiz, Long id) {
                setField(quiz, "id", id);
        }

        private void setQuestionId(Question question, Long id) {
                setField(question, "id", id);
        }

        private void setOptionId(Option option, Long id) {
                setField(option, "id", id);
        }

        private void setAttemptId(QuizAttempt attempt, Long id) {
                setField(attempt, "id", id);
        }

        private void setStudentAnswerId(StudentAnswer answer, Long id) {
                setField(answer, "id", id);
        }

        private void setField(
                        Object target,
                        String fieldName,
                        Object value) {

                try {
                        var field = target.getClass().getDeclaredField(fieldName);
                        field.setAccessible(true);
                        field.set(target, value);
                } catch (ReflectiveOperationException e) {
                        throw new IllegalStateException(
                                        "Unable to set test fixture field: " + fieldName,
                                        e);
                }
        }

        private void stubStudentAnswerSaveWithId(Long id) {
                when(studentAnswerRepository.save(any(StudentAnswer.class)))
                                .thenAnswer(invocation -> {
                                        StudentAnswer answer = invocation.getArgument(0);

                                        if (answer.getId() == null) {
                                                setStudentAnswerId(answer, id);
                                        }

                                        return answer;
                                });
        }
}
