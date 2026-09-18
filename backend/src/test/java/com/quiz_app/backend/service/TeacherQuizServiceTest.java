package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

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
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;

@ExtendWith(MockitoExtension.class)
class TeacherQuizServiceTest {

    @Mock
    private QuizRepository quizRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private OptionRepository optionRepository;

    @InjectMocks
    private TeacherQuizService teacherQuizService;

    private Quiz quiz;
    private User teacher;
    private Question question;
    private Option option1;
    private Option option2;

    @BeforeEach
    void setUp() {
        teacher = mock(User.class);
        when(teacher.getId()).thenReturn(2L);

        quiz = mock(Quiz.class);

        when(quiz.getId()).thenReturn(10L);
        when(quiz.getTeacher()).thenReturn(teacher);
        when(quiz.getStatus()).thenReturn(QuizStatus.DRAFT);
        when(quiz.getOverallTimerSeconds()).thenReturn(1800);
        when(quiz.getStartTime())
                .thenReturn(LocalDateTime.now().plusHours(1));
        when(quiz.getEndTime())
                .thenReturn(LocalDateTime.now().plusHours(2));
        when(quiz.isNegativeMarking()).thenReturn(false);

        question = mock(Question.class);

        when(question.getId()).thenReturn(100L);
        when(question.getQuestionType())
                .thenReturn(QuestionType.MCQ);
        when(question.getQuestionText())
                .thenReturn("What is Java?");
        when(question.getImageUrl())
                .thenReturn(null);
        when(question.getMarks())
                .thenReturn(BigDecimal.ONE);
        when(question.getNegativeMarks())
                .thenReturn(BigDecimal.ZERO);
        when(question.getDisplayOrder())
                .thenReturn(1);

        option1 = mock(Option.class);
        when(option1.getId()).thenReturn(101L);
        when(option1.getOptionText()).thenReturn("Java");
        when(option1.getOptionImage()).thenReturn(null);
        when(option1.isCorrect()).thenReturn(true);
        when(option1.getOptionOrder()).thenReturn((short) 1);

        option2 = mock(Option.class);
        when(option2.getId()).thenReturn(102L);
        when(option2.getOptionText()).thenReturn("Python");
        when(option2.getOptionImage()).thenReturn(null);
        when(option2.isCorrect()).thenReturn(false);
        when(option2.getOptionOrder()).thenReturn((short) 2);
    }

    @Test
    void publishQuiz_shouldPublishDraftQuiz() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        teacherQuizService.publishQuiz(10L, 2L);

        verify(quiz).setTotalQuestions(1);
        verify(quiz).setTotalMarks(BigDecimal.ONE);
        verify(quiz).setStatus(QuizStatus.PUBLISHED);
        verify(quiz).setExamState(ExamState.WAITING);
        verify(quizRepository).save(quiz);
    }

    @Test
    void publishQuiz_shouldRejectUnauthorizedTeacher() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(teacher.getId()).thenReturn(999L);

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));

        verify(quizRepository, never()).save(any());
    }

    @Test
    void publishQuiz_shouldRejectNullQuizId() {
        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(null, 2L));
    }

    @Test
    void publishQuiz_shouldRejectNullTeacherId() {
        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, null));
    }

    @Test
    void publishQuiz_shouldRejectMissingQuiz() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishQuiz_shouldRejectNonDraftQuiz() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.PUBLISHED);

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishQuiz_shouldRejectEmptyQuestions() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of());

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishQuiz_shouldRejectInvalidTimer() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        when(quiz.getOverallTimerSeconds())
                .thenReturn(0);

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishQuiz_shouldRejectMissingStartTime() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        when(quiz.getStartTime()).thenReturn(null);

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishQuiz_shouldRejectEndBeforeStart() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(questionRepository
                .findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));

        when(optionRepository
                .findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option1, option2));

        LocalDateTime start = LocalDateTime.now().plusHours(2);
        LocalDateTime end = LocalDateTime.now().plusHours(1);

        when(quiz.getStartTime()).thenReturn(start);
        when(quiz.getEndTime()).thenReturn(end);

        assertThrows(
                BadRequestException.class,
                () -> teacherQuizService.publishQuiz(10L, 2L));
    }

    @Test
    void publishResults_shouldPublishResults() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.COMPLETED);

        teacherQuizService.publishResults(10L, 2L);

        verify(quiz).setResultsPublished(true);
        verify(quizRepository).save(quiz);
    }

    @Test
    void unpublishResults_shouldHideResults() {

        when(quizRepository.findById(10L))
                .thenReturn(Optional.of(quiz));

        when(quiz.getStatus())
                .thenReturn(QuizStatus.COMPLETED);

        teacherQuizService.unpublishResults(10L, 2L);

        verify(quiz).setResultsPublished(false);
        verify(quizRepository).save(quiz);
    }

}