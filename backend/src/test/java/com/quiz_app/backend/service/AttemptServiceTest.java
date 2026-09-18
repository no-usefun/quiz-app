package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SaveAnswerRequest;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.entity.AnswerStatus;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.StudentAnswer;
import com.quiz_app.backend.entity.StudentSelectedOption;
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

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        when(quizAttemptRepository
                .existsByQuizQuizCodeAndStudentId(
                        "123456",
                        student.getId()))
                .thenReturn(false);

        when(quizAttemptRepository.save(any(QuizAttempt.class)))
                .thenReturn(attempt);

        AttemptResponse response = attemptService.startAttempt("123456", request);

        assertNotNull(response);

        assertEquals(1000L, response.attemptId());
        assertEquals(10L, response.quizId());
        assertEquals(1L, response.studentId());

        assertEquals(
                AttemptStatus.IN_PROGRESS,
                response.status());

        assertEquals(1, response.currentQuestion());
        assertEquals(0, response.totalTimeTaken());

        verify(quizAttemptRepository)
                .save(any(QuizAttempt.class));
    }

    @Test
    void startAttempt_shouldRejectNullQuizCode() {

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        null,
                        request));

        verifyNoInteractions(userRepository);
        verifyNoInteractions(quizRepository);
    }

    @Test
    void startAttempt_shouldRejectBlankQuizCode() {

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "   ",
                        request));

        verifyNoInteractions(userRepository);
        verifyNoInteractions(quizRepository);
    }

    @Test
    void startAttempt_shouldRejectNullRequest() {

        assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        null));

        verifyNoInteractions(userRepository);
        verifyNoInteractions(quizRepository);
    }

    @Test
    void startAttempt_shouldRejectMissingStudentId() {

        StartAttemptRequest request = new StartAttemptRequest(null);

        assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        verifyNoInteractions(userRepository);
    }

    @Test
    void startAttempt_shouldRejectUnknownStudent() {

        StartAttemptRequest request = new StartAttemptRequest(999L);

        when(userRepository.findById(999L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        verify(userRepository).findById(999L);

        verifyNoInteractions(quizRepository);
    }

    @Test
    void startAttempt_shouldRejectNonStudent() {

        StartAttemptRequest request = new StartAttemptRequest(teacher.getId());

        when(userRepository.findById(teacher.getId()))
                .thenReturn(Optional.of(teacher));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        assertEquals(
                "Only a student can start a quiz",
                exception.getMessage());

        verify(userRepository)
                .findById(teacher.getId());

        verifyNoInteractions(quizRepository);
    }

    @Test
    void startAttempt_shouldRejectUnknownQuiz() {

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        verify(quizRepository)
                .findByQuizCode("123456");
    }

    @Test
    void startAttempt_shouldRejectUnpublishedQuiz() {

        when(quiz.getStatus())
                .thenReturn(QuizStatus.DRAFT);

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        assertEquals(
                "Quiz is not available",
                exception.getMessage());

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void startAttempt_shouldRejectQuizThatHasNotStarted() {

        when(quiz.getStartTime())
                .thenReturn(LocalDateTime.now().plusHours(1));

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        assertEquals(
                "Quiz has not started yet",
                exception.getMessage());

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void startAttempt_shouldRejectQuizThatHasEnded() {

        when(quiz.getEndTime())
                .thenReturn(LocalDateTime.now().minusHours(1));

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        assertEquals(
                "Quiz has already ended",
                exception.getMessage());

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void startAttempt_shouldRejectDuplicateAttempt() {

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        when(quizAttemptRepository
                .existsByQuizQuizCodeAndStudentId(
                        "123456",
                        student.getId()))
                .thenReturn(true);

        ConflictException exception = assertThrows(
                ConflictException.class,
                () -> attemptService.startAttempt(
                        "123456",
                        request));

        assertEquals(
                "Student has already attempted this quiz",
                exception.getMessage());

        verify(quizAttemptRepository)
                .existsByQuizQuizCodeAndStudentId(
                        "123456",
                        student.getId());

        verify(
                quizAttemptRepository,
                never())
                .save(any(QuizAttempt.class));
    }

    @Test
    void startAttempt_shouldInitializeAttemptFieldsCorrectly() {

        StartAttemptRequest request = new StartAttemptRequest(student.getId());

        when(userRepository.findById(student.getId()))
                .thenReturn(Optional.of(student));

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        when(quizAttemptRepository
                .existsByQuizQuizCodeAndStudentId(
                        "123456",
                        student.getId()))
                .thenReturn(false);

        when(quizAttemptRepository.save(any(QuizAttempt.class)))
                .thenReturn(attempt);

        attemptService.startAttempt(
                "123456",
                request);

        verify(attempt).setQuiz(quiz);
        verify(attempt).setStudent(student);
        verify(attempt).setStatus(
                AttemptStatus.IN_PROGRESS);

        verify(attempt).setCurrentQuestion(1);
        verify(attempt).setTotalTimeTaken(0);

        verify(attempt).setWarningsCount(0);
        verify(attempt).setRefreshCount(0);
        verify(attempt).setReconnectCount(0);

        verify(attempt).setFinalScore(
                BigDecimal.ZERO);

        verify(attempt).setStartedAt(
                any(LocalDateTime.class));

        verify(attempt).setCreatedAt(
                any(LocalDateTime.class));

        verify(quizAttemptRepository)
                .save(attempt);
    }

    // =========================================================
    // SAVE ANSWER
    // =========================================================

    @Test
    void saveAnswer_shouldSaveAnsweredQuestion() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(option1.getId()),
                15);

        StudentAnswer savedAnswer = mock(StudentAnswer.class);

        when(savedAnswer.getId())
                .thenReturn(500L);

        when(savedAnswer.getAttempt())
                .thenReturn(attempt);

        when(savedAnswer.getQuestion())
                .thenReturn(mcqQuestion);

        when(savedAnswer.getAnswerStatus())
                .thenReturn(AnswerStatus.ANSWERED);

        when(savedAnswer.getResponseTimeSeconds())
                .thenReturn(15);

        when(savedAnswer.getAnsweredAt())
                .thenReturn(LocalDateTime.now());

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(optionRepository.findById(option1.getId()))
                .thenReturn(Optional.of(option1));

        when(studentAnswerRepository
                .findByAttemptIdAndQuestionId(
                        attempt.getId(),
                        mcqQuestion.getId()))
                .thenReturn(Optional.empty());

        when(studentAnswerRepository
                .save(any(StudentAnswer.class)))
                .thenReturn(savedAnswer);

        AnswerResponse response = attemptService.saveAnswer(
                attempt.getId(),
                mcqQuestion.getId(),
                request);

        assertNotNull(response);

        assertEquals(
                500L,
                response.answerId());

        assertEquals(
                1000L,
                response.attemptId());

        assertEquals(
                100L,
                response.questionId());

        assertEquals(
                List.of(101L),
                response.selectedOptionIds());

        assertEquals(
                15,
                response.responseTimeSeconds());

        assertNotNull(response.answeredAt());

        verify(studentAnswerRepository)
                .save(any(StudentAnswer.class));

        verify(studentSelectedOptionRepository)
                .deleteByAnswerId(500L);

        verify(studentSelectedOptionRepository)
                .save(any(StudentSelectedOption.class));
    }

    @Test
    void saveAnswer_shouldRejectNullAttemptId() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        null,
                        100L,
                        request));

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void saveAnswer_shouldRejectNullQuestionId() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        1000L,
                        null,
                        request));

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void saveAnswer_shouldRejectNullRequest() {

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        1000L,
                        100L,
                        null));

        verifyNoInteractions(quizAttemptRepository);
    }

    @Test
    void saveAnswer_shouldRejectUnknownAttempt() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        when(quizAttemptRepository.findById(1000L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> attemptService.saveAnswer(
                        1000L,
                        100L,
                        request));

        verify(quizAttemptRepository)
                .findById(1000L);

        verifyNoInteractions(questionRepository);
    }

    @Test
    void saveAnswer_shouldRejectCompletedAttempt() {

        when(attempt.getStatus())
                .thenReturn(AttemptStatus.SUBMITTED);

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        mcqQuestion.getId(),
                        request));

        assertEquals(
                "Cannot modify an attempt that is not in progress",
                exception.getMessage());

        verifyNoInteractions(questionRepository);
    }

    @Test
    void saveAnswer_shouldRejectUnknownQuestion() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(999L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        999L,
                        request));

        verify(questionRepository)
                .findById(999L);
    }

    @Test
    void saveAnswer_shouldRejectQuestionFromAnotherQuiz() {

        Quiz anotherQuiz = mock(Quiz.class);

        when(anotherQuiz.getId())
                .thenReturn(999L);

        Question anotherQuestion = mock(Question.class);

        when(anotherQuestion.getId())
                .thenReturn(999L);

        when(anotherQuestion.getQuiz())
                .thenReturn(anotherQuiz);

        when(anotherQuestion.getQuestionType())
                .thenReturn(QuestionType.MCQ);

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(101L),
                10);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(999L))
                .thenReturn(Optional.of(anotherQuestion));

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        999L,
                        request));

        verifyNoInteractions(optionRepository);
    }

    @Test
    void saveAnswer_shouldRejectNegativeResponseTime() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(option1.getId()),
                -1);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        mcqQuestion.getId(),
                        request));

        assertEquals(
                "Response time cannot be negative",
                exception.getMessage());

        verifyNoInteractions(optionRepository);
    }

    @Test
    void saveAnswer_shouldRejectUnknownOption() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(999L),
                10);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(optionRepository.findById(999L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        mcqQuestion.getId(),
                        request));

        verify(optionRepository)
                .findById(999L);
    }

    @Test
    void saveAnswer_shouldRejectOptionFromAnotherQuestion() {

        Question anotherQuestion = mock(Question.class);

        when(anotherQuestion.getId())
                .thenReturn(200L);

        when(anotherQuestion.getQuiz())
                .thenReturn(quiz);

        Option foreignOption = mock(Option.class);

        when(foreignOption.getId())
                .thenReturn(999L);

        when(foreignOption.getQuestion())
                .thenReturn(anotherQuestion);

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(999L),
                10);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(optionRepository.findById(999L))
                .thenReturn(Optional.of(foreignOption));

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        mcqQuestion.getId(),
                        request));

        verify(
                studentAnswerRepository,
                never())
                .save(any(StudentAnswer.class));
    }

    @Test
    void saveAnswer_shouldRejectMultipleOptionsForMcq() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(
                        option1.getId(),
                        option2.getId()),
                20);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(optionRepository.findById(option1.getId()))
                .thenReturn(Optional.of(option1));

        when(optionRepository.findById(option2.getId()))
                .thenReturn(Optional.of(option2));

        assertThrows(
                BadRequestException.class,
                () -> attemptService.saveAnswer(
                        attempt.getId(),
                        mcqQuestion.getId(),
                        request));

        verify(
                studentAnswerRepository,
                never())
                .save(any(StudentAnswer.class));
    }

    @Test
    void saveAnswer_shouldAllowEmptySelectionAsUnanswered() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(),
                10);

        StudentAnswer savedAnswer = mock(StudentAnswer.class);

        when(savedAnswer.getId())
                .thenReturn(500L);

        when(savedAnswer.getAttempt())
                .thenReturn(attempt);

        when(savedAnswer.getQuestion())
                .thenReturn(mcqQuestion);

        when(savedAnswer.getResponseTimeSeconds())
                .thenReturn(10);

        when(savedAnswer.getAnsweredAt())
                .thenReturn(null);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(studentAnswerRepository
                .findByAttemptIdAndQuestionId(
                        attempt.getId(),
                        mcqQuestion.getId()))
                .thenReturn(Optional.empty());

        when(studentAnswerRepository
                .save(any(StudentAnswer.class)))
                .thenReturn(savedAnswer);

        AnswerResponse response = attemptService.saveAnswer(
                attempt.getId(),
                mcqQuestion.getId(),
                request);

        assertTrue(
                response.selectedOptionIds().isEmpty());

        assertNull(response.answeredAt());

        ArgumentCaptor<StudentAnswer> captor = ArgumentCaptor.forClass(StudentAnswer.class);

        verify(studentAnswerRepository)
                .save(captor.capture());

        StudentAnswer answer = captor.getValue();

        verify(answer)
                .setAnswerStatus(
                        AnswerStatus.UNANSWERED);

        verify(answer)
                .setCorrect(false);

        verify(answer)
                .setMarksAwarded(BigDecimal.ZERO);

        verify(answer)
                .setAnsweredAt(null);

        verify(studentSelectedOptionRepository)
                .deleteByAnswerId(500L);

        verify(
                studentSelectedOptionRepository,
                never())
                .save(any(StudentSelectedOption.class));
    }

    @Test
    void saveAnswer_shouldAllowNullSelectedOptionsAsUnanswered() {

        SaveAnswerRequest request = new SaveAnswerRequest(
                null,
                10);

        StudentAnswer savedAnswer = mock(StudentAnswer.class);

        when(savedAnswer.getId())
                .thenReturn(500L);

        when(savedAnswer.getResponseTimeSeconds())
                .thenReturn(10);

        when(savedAnswer.getAnsweredAt())
                .thenReturn(null);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(studentAnswerRepository
                .findByAttemptIdAndQuestionId(
                        attempt.getId(),
                        mcqQuestion.getId()))
                .thenReturn(Optional.empty());

        when(studentAnswerRepository
                .save(any(StudentAnswer.class)))
                .thenReturn(savedAnswer);

        AnswerResponse response = attemptService.saveAnswer(
                attempt.getId(),
                mcqQuestion.getId(),
                request);

        assertTrue(
                response.selectedOptionIds().isEmpty());

        verify(studentAnswerRepository)
                .save(any(StudentAnswer.class));
    }

    @Test
    void saveAnswer_shouldUpdateExistingAnswer() {

        StudentAnswer existingAnswer = mock(StudentAnswer.class);

        when(existingAnswer.getId())
                .thenReturn(500L);

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(option1.getId()),
                25);

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(mcqQuestion.getId()))
                .thenReturn(Optional.of(mcqQuestion));

        when(optionRepository.findById(option1.getId()))
                .thenReturn(Optional.of(option1));

        when(studentAnswerRepository
                .findByAttemptIdAndQuestionId(
                        attempt.getId(),
                        mcqQuestion.getId()))
                .thenReturn(Optional.of(existingAnswer));

        when(studentAnswerRepository
                .save(any(StudentAnswer.class)))
                .thenReturn(existingAnswer);

        AnswerResponse response = attemptService.saveAnswer(
                attempt.getId(),
                mcqQuestion.getId(),
                request);

        assertEquals(
                500L,
                response.answerId());

        assertEquals(
                List.of(101L),
                response.selectedOptionIds());

        verify(studentAnswerRepository)
                .save(existingAnswer);

        verify(studentSelectedOptionRepository)
                .deleteByAnswerId(500L);

        verify(studentSelectedOptionRepository)
                .save(any(StudentSelectedOption.class));
    }

    // =========================================================
    // MSQ
    // =========================================================

    @Test
    void saveAnswer_shouldAllowMultipleOptionsForMsq() {

        Question msqQuestion = mock(Question.class);

        when(msqQuestion.getId())
                .thenReturn(300L);

        when(msqQuestion.getQuiz())
                .thenReturn(quiz);

        when(msqQuestion.getQuestionType())
                .thenReturn(QuestionType.MSQ);

        Option msqOption1 = mock(Option.class);

        when(msqOption1.getId())
                .thenReturn(301L);

        when(msqOption1.getQuestion())
                .thenReturn(msqQuestion);

        Option msqOption2 = mock(Option.class);

        when(msqOption2.getId())
                .thenReturn(302L);

        when(msqOption2.getQuestion())
                .thenReturn(msqQuestion);

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(301L, 302L),
                30);

        StudentAnswer savedAnswer = mock(StudentAnswer.class);

        when(savedAnswer.getId())
                .thenReturn(600L);

        when(savedAnswer.getAttempt())
                .thenReturn(attempt);

        when(savedAnswer.getQuestion())
                .thenReturn(msqQuestion);

        when(savedAnswer.getResponseTimeSeconds())
                .thenReturn(30);

        when(savedAnswer.getAnsweredAt())
                .thenReturn(LocalDateTime.now());

        when(quizAttemptRepository.findById(attempt.getId()))
                .thenReturn(Optional.of(attempt));

        when(questionRepository.findById(300L))
                .thenReturn(Optional.of(msqQuestion));

        when(optionRepository.findById(301L))
                .thenReturn(Optional.of(msqOption1));

        when(optionRepository.findById(302L))
                .thenReturn(Optional.of(msqOption2));

        when(studentAnswerRepository
                .findByAttemptIdAndQuestionId(
                        attempt.getId(),
                        300L))
                .thenReturn(Optional.empty());

        when(studentAnswerRepository
                .save(any(StudentAnswer.class)))
                .thenReturn(savedAnswer);

        AnswerResponse response = attemptService.saveAnswer(
                attempt.getId(),
                300L,
                request);

        assertEquals(
                List.of(301L, 302L),
                response.selectedOptionIds());

        verify(
                studentSelectedOptionRepository,
                times(2))
                .save(any(StudentSelectedOption.class));
    }
}