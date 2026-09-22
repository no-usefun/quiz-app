package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.OptionRequest;
import com.quiz_app.backend.dto.quiz.QuestionRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAllowedStudent;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuizServiceTest {

    @Mock
    private QuizRepository quizRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private OptionRepository optionRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private QuizAllowedStudentRepository quizAllowedStudentRepository;

    @InjectMocks
    private QuizService quizService;

    private User teacher;
    private Role teacherRole;

    private Quiz quiz;

    private Question question;

    private Option option1;
    private Option option2;

    private CreateQuizRequest request;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    @BeforeEach
    void setUp() {

        // =========================================================
        // TEACHER
        // =========================================================

        teacherRole = new Role();
        teacherRole.setName("TEACHER");

        teacher = mock(User.class);

        when(teacher.getId()).thenReturn(2L);
        when(teacher.getRole()).thenReturn(teacherRole);

        // =========================================================
        // QUIZ
        // =========================================================

        quiz = mock(Quiz.class);

        when(quiz.getId()).thenReturn(10L);
        when(quiz.getQuizCode()).thenReturn("123456");

        when(quiz.getTitle()).thenReturn("Java Test");
        when(quiz.getDescription()).thenReturn("Java basics");
        when(quiz.getInstructions())
                .thenReturn("Read all questions carefully.");

        when(quiz.getSubject()).thenReturn("Computer Science");
        when(quiz.getSubjectCode()).thenReturn("CS-201");

        when(quiz.getTotalStudents()).thenReturn(30);
        when(quiz.getTotalQuestions()).thenReturn(1);
        when(quiz.getTotalMarks()).thenReturn(BigDecimal.ONE);

        when(quiz.getOverallTimerSeconds()).thenReturn(1800);

        when(quiz.isNegativeMarking()).thenReturn(false);
        when(quiz.getNegativeMarks()).thenReturn(BigDecimal.ZERO);

        when(quiz.isTimeBonusEnabled()).thenReturn(false);
        when(quiz.isRandomQuestionOrder()).thenReturn(false);
        when(quiz.isRandomOptionOrder()).thenReturn(false);
        when(quiz.isAllowReview()).thenReturn(true);
        when(quiz.isAllowResume()).thenReturn(true);
        when(quiz.isAutoSubmit()).thenReturn(true);

        startTime = LocalDateTime.of(2026, 9, 20, 10, 0);
        endTime = LocalDateTime.of(2026, 9, 20, 11, 0);

        when(quiz.getStartTime()).thenReturn(startTime);
        when(quiz.getEndTime()).thenReturn(endTime);

        when(quiz.getResultVisibility())
                .thenReturn(ResultVisibility.NONE);

        when(quiz.isResultsPublished()).thenReturn(false);

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        when(quiz.getExamState())
                .thenReturn(ExamState.WAITING);

        when(quiz.isNegativeMarking()).thenReturn(false);

        // =========================================================
        // QUESTION
        // =========================================================

        question = mock(Question.class);

        when(question.getId()).thenReturn(100L);
        when(question.getQuiz()).thenReturn(quiz);

        when(question.getQuestionText())
                .thenReturn("Which language is used by Spring Boot?");

        when(question.getImageUrl()).thenReturn(null);

        when(question.getQuestionType())
                .thenReturn(QuestionType.MCQ);

        when(question.getMarks())
                .thenReturn(BigDecimal.ONE);

        when(question.getNegativeMarks())
                .thenReturn(BigDecimal.ZERO);

        when(question.getQuestionTimerSeconds())
                .thenReturn(60);

        when(question.getDifficulty())
                .thenReturn(Difficulty.EASY);

        when(question.getDisplayOrder())
                .thenReturn(1);

        // =========================================================
        // OPTIONS
        // =========================================================

        option1 = mock(Option.class);

        when(option1.getId()).thenReturn(101L);
        when(option1.getQuestion()).thenReturn(question);
        when(option1.getOptionText()).thenReturn("Java");
        when(option1.getOptionImage()).thenReturn(null);
        when(option1.isCorrect()).thenReturn(true);
        when(option1.getOptionOrder()).thenReturn((short) 1);

        option2 = mock(Option.class);

        when(option2.getId()).thenReturn(102L);
        when(option2.getQuestion()).thenReturn(question);
        when(option2.getOptionText()).thenReturn("Python");
        when(option2.getOptionImage()).thenReturn(null);
        when(option2.isCorrect()).thenReturn(false);
        when(option2.getOptionOrder()).thenReturn((short) 2);

        // =========================================================
        // REQUEST
        // =========================================================

        OptionRequest correctOption = new OptionRequest(
                "Java",
                null,
                (short) 1,
                true);

        OptionRequest incorrectOption = new OptionRequest(
                "Python",
                null,
                (short) 2,
                false);

        QuestionRequest questionRequest = new QuestionRequest(
                "Which language is used by Spring Boot?",
                null,
                "Java",
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        correctOption,
                        incorrectOption));

        request = new CreateQuizRequest(
                "Java Test",
                "Java basics",
                "Read all questions carefully.",
                "Computer Science",
                "CS-201",
                30,
                1800,
                false,
                BigDecimal.ZERO,
                false,
                false,
                false,
                true,
                true,
                true,
                startTime,
                endTime,
                ResultVisibility.NONE,
                "@vitap.ac.in",
                List.of("21BCE0001"),
                List.of(questionRequest));
    }

    // =========================================================
    // CREATE QUIZ
    // =========================================================

    @Test
    void createQuiz_shouldCreateQuizSuccessfully() {

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        QuizResponse response = quizService.createQuiz(request, 2L);

        assertNotNull(response);

        assertEquals(10L, response.quizId());
        assertEquals("123456", response.quizCode());
        assertEquals(2L, response.teacherId());

        assertEquals("Java Test", response.title());
        assertEquals("Java basics", response.description());
        assertEquals("Computer Science", response.subject());
        assertEquals("CS-201", response.subjectCode());

        assertEquals(30, response.totalStudents());
        assertEquals(1, response.totalQuestions());
        assertEquals(BigDecimal.ONE, response.totalMarks());

        verify(quizRepository)
                .save(any(Quiz.class));

        verify(questionRepository)
                .save(any(Question.class));

        verify(optionRepository, atLeastOnce())
                .save(any(Option.class));
    }

    @Test
    void createQuiz_shouldInitializeQuizAsDraft() {

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        quizService.createQuiz(request, 2L);

        ArgumentCaptor<Quiz> captor = ArgumentCaptor.forClass(Quiz.class);

        verify(quizRepository)
                .save(captor.capture());

        Quiz savedQuiz = captor.getValue();

        assertEquals(
                QuizStatus.DRAFT,
                savedQuiz.getStatus());

        assertEquals(
                ExamState.WAITING,
                savedQuiz.getExamState());

        assertFalse(
                savedQuiz.isResultsPublished());

        assertNotNull(
                savedQuiz.getQuizCode());

        assertEquals(
                6,
                savedQuiz.getQuizCode().length());

        assertEquals(
                BigDecimal.ONE,
                savedQuiz.getTotalMarks());

        assertEquals(
                1,
                savedQuiz.getTotalQuestions());

        assertEquals(
                "@vitap.ac.in",
                savedQuiz.getAcceptedEmailDomain());
    }

    @Test
    void createQuiz_shouldNormalizeAcceptedEmailDomain() {

        CreateQuizRequest modifiedRequest = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                "  @VITAP.AC.IN  ",
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        quizService.createQuiz(modifiedRequest, 2L);

        ArgumentCaptor<Quiz> captor = ArgumentCaptor.forClass(Quiz.class);

        verify(quizRepository)
                .save(captor.capture());

        assertEquals(
                "@vitap.ac.in",
                captor.getValue().getAcceptedEmailDomain());
    }

    @Test
    void createQuiz_shouldRejectInvalidAcceptedEmailDomain() {

        CreateQuizRequest modifiedRequest = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                "vitap.ac.in",
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        modifiedRequest,
                        2L));

        verify(quizRepository, never())
                .save(any(Quiz.class));
    }

    @Test
    void createQuiz_shouldSaveAllowedRegistrationNumbers() {

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        quizService.createQuiz(request, 2L);

        ArgumentCaptor<QuizAllowedStudent> captor = ArgumentCaptor.forClass(QuizAllowedStudent.class);

        verify(quizAllowedStudentRepository)
                .save(captor.capture());

        QuizAllowedStudent saved = captor.getValue();

        assertEquals(
                quiz,
                saved.getQuiz());

        assertEquals(
                "21BCE0001",
                saved.getRegistrationNumber());
    }

    // =========================================================
    // TEACHER VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldRejectNullTeacherId() {

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        null));
    }

    @Test
    void createQuiz_shouldRejectUnknownTeacher() {

        when(userRepository.findById(999L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> quizService.createQuiz(
                        request,
                        999L));

        verify(quizRepository, never())
                .save(any(Quiz.class));
    }

    @Test
    void createQuiz_shouldRejectNonTeacher() {

        User student = mock(User.class);

        Role studentRole = new Role();
        studentRole.setName("STUDENT");

        when(student.getRole())
                .thenReturn(studentRole);

        when(userRepository.findById(1L))
                .thenReturn(Optional.of(student));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        1L));

        assertEquals(
                "Only a teacher can create a quiz",
                exception.getMessage());

        verify(quizRepository, never())
                .save(any(Quiz.class));
    }

    // =========================================================
    // QUIZ VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldRejectBlankTitle() {

        request = new CreateQuizRequest(
                "   ",
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectMissingSubject() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                null,
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectMissingSubjectCode() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                null,
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectNegativeTotalStudents() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                -1,
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectEmptyQuestions() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                List.of());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectMissingResultVisibility() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                null,
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectNegativeQuizNegativeMarks() {

        request = new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                true,
                new BigDecimal("-1"),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                request.questions());

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));

        assertEquals(
                "Negative marks cannot be negative",
                exception.getMessage());
    }

    // =========================================================
    // QUESTION VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldRejectQuestionWithoutTextOrImage() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "   ",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectQuestionWithoutType() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                null,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Language",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Database",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectQuestionWithZeroMarks() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Language",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Database",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectQuestionWithNoOptions() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of());

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    // =========================================================
    // MCQ VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldRejectMcqWithNoCorrectOption() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                false),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectMcqWithMultipleCorrectOptions() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                true)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    // =========================================================
    // MSQ VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldAcceptMsqWithMultipleCorrectOptions() {

        QuestionRequest validQuestion = new QuestionRequest(
                "Which are programming languages?",
                null,
                null,
                QuestionType.MSQ,
                BigDecimal.TWO,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                true),
                        new OptionRequest(
                                "PostgreSQL",
                                null,
                                (short) 3,
                                false)));

        request = withQuestions(List.of(validQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        assertNotNull(
                quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectMsqWithNoCorrectOption() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "Which are programming languages?",
                null,
                null,
                QuestionType.MSQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                false),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    // =========================================================
    // TRUE / FALSE VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldAcceptValidTrueFalseQuestion() {

        QuestionRequest validQuestion = new QuestionRequest(
                "Java is a programming language.",
                null,
                null,
                QuestionType.TRUE_FALSE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "True",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "False",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(validQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        assertNotNull(
                quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectTrueFalseWithWrongOptionCount() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "Java is a programming language.",
                null,
                null,
                QuestionType.TRUE_FALSE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "True",
                                null,
                                (short) 1,
                                true)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectTrueFalseWithMultipleCorrectOptions() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "Java is a programming language.",
                null,
                null,
                QuestionType.TRUE_FALSE,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "True",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "False",
                                null,
                                (short) 2,
                                true)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    // =========================================================
    // OPTION VALIDATION
    // =========================================================

    @Test
    void createQuiz_shouldRejectNullOption() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                java.util.Arrays.asList(
                        new OptionRequest(
                                "Java",
                                null,
                                (short) 1,
                                true),
                        null));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldRejectOptionWithoutTextOrImage() {

        QuestionRequest invalidQuestion = new QuestionRequest(
                "What is Java?",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                "   ",
                                null,
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(invalidQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        assertThrows(
                BadRequestException.class,
                () -> quizService.createQuiz(
                        request,
                        2L));
    }

    @Test
    void createQuiz_shouldAcceptOptionWithImageOnly() {

        QuestionRequest validQuestion = new QuestionRequest(
                "Identify the language.",
                null,
                null,
                QuestionType.MCQ,
                BigDecimal.ONE,
                BigDecimal.ZERO,
                60,
                Difficulty.EASY,
                1,
                List.of(
                        new OptionRequest(
                                null,
                                "java.png",
                                (short) 1,
                                true),
                        new OptionRequest(
                                "Python",
                                null,
                                (short) 2,
                                false)));

        request = withQuestions(List.of(validQuestion));

        when(userRepository.findById(2L))
                .thenReturn(Optional.of(teacher));

        when(quizRepository.existsByQuizCode(anyString()))
                .thenReturn(false);

        when(quizRepository.save(any(Quiz.class)))
                .thenReturn(quiz);

        when(questionRepository.save(any(Question.class)))
                .thenReturn(question);

        when(optionRepository.save(any(Option.class)))
                .thenReturn(option1);

        when(quizAllowedStudentRepository.findByQuizId(10L))
                .thenReturn(List.of());

        assertNotNull(
                quizService.createQuiz(
                        request,
                        2L));
    }

    // =========================================================
    // GET QUIZ PACKAGE
    // =========================================================

    @Test
    void getQuizPackage_shouldReturnPublishedQuiz() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        QuizPackageResponse response = quizService.getQuizPackage(10L);

        assertNotNull(response);

        assertEquals(
                10L,
                response.quizId());

        assertEquals(
                "Java Test",
                response.title());

        assertEquals(
                "Java basics",
                response.description());

        assertEquals(
                "Read all questions carefully.",
                response.instructions());

        assertEquals(
                "Computer Science",
                response.subject());

        assertEquals(
                "CS-201",
                response.subjectCode());

        assertEquals(
                30,
                response.totalStudents());

        assertEquals(
                1,
                response.totalQuestions());

        assertEquals(
                BigDecimal.ONE,
                response.totalMarks());

        assertEquals(
                1800,
                response.overallTimerSeconds());

        assertEquals(
                1,
                response.questions().size());

        assertEquals(
                2,
                response.questions()
                        .get(0)
                        .options()
                        .size());
    }

    @Test
    void getQuizPackage_shouldMapQuestionFields() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        QuizPackageResponse response = quizService.getQuizPackage(10L);

        var mappedQuestion = response.questions().get(0);

        assertEquals(
                100L,
                mappedQuestion.questionId());

        assertEquals(
                "Which language is used by Spring Boot?",
                mappedQuestion.questionText());

        assertEquals(
                QuestionType.MCQ,
                mappedQuestion.questionType());

        assertEquals(
                BigDecimal.ONE,
                mappedQuestion.marks());

        assertEquals(
                BigDecimal.ZERO,
                mappedQuestion.negativeMarks());

        assertEquals(
                60,
                mappedQuestion.questionTimerSeconds());

        assertEquals(
                Difficulty.EASY,
                mappedQuestion.difficulty());

        assertEquals(
                1,
                mappedQuestion.displayOrder());
    }

    @Test
    void getQuizPackage_shouldMapOptionFields() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        QuizPackageResponse response = quizService.getQuizPackage(10L);

        var options = response.questions()
                .get(0)
                .options();

        assertEquals(
                101L,
                options.get(0).optionId());

        assertEquals(
                "Java",
                options.get(0).optionText());

        assertEquals(
                (short) 1,
                options.get(0).optionOrder());

        assertEquals(
                102L,
                options.get(1).optionId());

        assertEquals(
                "Python",
                options.get(1).optionText());

        assertEquals(
                (short) 2,
                options.get(1).optionOrder());
    }

    @Test
    void getQuizPackage_shouldRejectUnknownQuiz() {

        when(quizRepository.findById(999L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> quizService.getQuizPackage(999L));
    }

    @Test
    void getQuizPackage_shouldRejectDraftQuiz() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.DRAFT);

        BadRequestException exception = assertThrows(
                BadRequestException.class,
                () -> quizService.getQuizPackage(10L));

        assertEquals(
                "Quiz is not available to students",
                exception.getMessage());

        verify(questionRepository, never())
                .findByQuizIdOrderByDisplayOrder(10L);
    }

    // =========================================================
    // GET QUIZ PACKAGE BY CODE
    // =========================================================

    @Test
    void getQuizPackageByCode_shouldReturnPackage() {

        when(quizRepository.findByQuizCode("123456"))
                .thenReturn(Optional.of(quiz));

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        QuizPackageResponse response = quizService.getQuizPackageByCode("123456");

        assertNotNull(response);

        assertEquals(
                10L,
                response.quizId());
    }

    @Test
    void getQuizPackageByCode_shouldRejectUnknownCode() {

        when(quizRepository.findByQuizCode("999999"))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> quizService.getQuizPackageByCode("999999"));
    }

    // =========================================================
    // HELPER
    // =========================================================

    private CreateQuizRequest withQuestions(
            List<QuestionRequest> questions) {

        return new CreateQuizRequest(
                request.title(),
                request.description(),
                request.instructions(),
                request.subject(),
                request.subjectCode(),
                request.totalStudents(),
                request.overallTimerSeconds(),
                request.negativeMarking(),
                request.negativeMarks(),
                request.timeBonusEnabled(),
                request.randomQuestionOrder(),
                request.randomOptionOrder(),
                request.allowReview(),
                request.allowResume(),
                request.autoSubmit(),
                request.startTime(),
                request.endTime(),
                request.resultVisibility(),
                request.acceptedEmailDomain(),
                request.allowedRegistrationNumbers(),
                questions);
    }
}