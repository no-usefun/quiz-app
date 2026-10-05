package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;

@ExtendWith(MockitoExtension.class)
class StudentQuizServiceTest {

    @Mock
    private QuizRepository quizRepository;
    @Mock
    private QuestionRepository questionRepository;
    @Mock
    private OptionRepository optionRepository;

    @Test
    void getQuizPackage_shouldBuildPublishedPackage() {
        Quiz quiz = new Quiz();
        setId(quiz, "id", 10L);
        quiz.setTitle("Java Test");
        quiz.setSubject("Java");
        quiz.setSubjectCode("JAVA101");
        quiz.setStatus(QuizStatus.PUBLISHED);
        quiz.setTotalStudents(20);
        quiz.setTotalQuestions(1);
        quiz.setTotalMarks(BigDecimal.TEN);
        quiz.setOverallTimerSeconds(600);
        quiz.setNegativeMarking(false);
        quiz.setNegativeMarks(BigDecimal.ZERO);
        quiz.setRandomQuestionOrder(false);
        quiz.setRandomOptionOrder(false);
        quiz.setAllowReview(true);
        quiz.setAllowResume(true);
        quiz.setAutoSubmit(true);

        Question question = new Question();
        setId(question, "id", 100L);
        question.setQuestionText("2 + 2?");
        question.setQuestionType(QuestionType.MCQ);
        question.setMarks(BigDecimal.TEN);
        question.setNegativeMarks(BigDecimal.ZERO);
        question.setQuestionTimerSeconds(30);
        question.setDifficulty(Difficulty.EASY);
        question.setDisplayOrder(1);

        Option option = new Option();
        setId(option, "id", 101L);
        option.setOptionText("4");
        option.setOptionOrder((short) 1);

        when(quizRepository.findById(10L)).thenReturn(Optional.of(quiz));
        when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                .thenReturn(List.of(question));
        when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                .thenReturn(List.of(option));

        var response = new StudentQuizService(
                quizRepository, questionRepository, optionRepository)
                .getQuizPackage(10L);

        assertEquals(10L, response.quizId());
        assertEquals("Java Test", response.title());
        assertEquals(1, response.questions().size());
        assertEquals(1, response.questions().get(0).options().size());
        assertEquals(101L, response.questions().get(0).options().get(0).optionId());
        verify(optionRepository).findByQuestionIdOrderByOptionOrder(100L);
    }

    @Test
    void getQuizPackage_shouldRejectUnpublishedQuiz() {
        Quiz quiz = new Quiz();
        quiz.setStatus(QuizStatus.DRAFT);

        when(quizRepository.findById(10L)).thenReturn(Optional.of(quiz));

        assertThrows(
                BadRequestException.class,
                () -> new StudentQuizService(
                        quizRepository, questionRepository, optionRepository)
                        .getQuizPackage(10L));
    }

    @Test
    void getQuizPackage_shouldRejectMissingQuiz() {
        when(quizRepository.findById(10L)).thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> new StudentQuizService(
                        quizRepository, questionRepository, optionRepository)
                        .getQuizPackage(10L));
    }

    @Test
    void getQuizPackageByCode_shouldResolveQuizAndDelegate() {
        Quiz quiz = new Quiz();
        setId(quiz, "id", 10L);
        quiz.setStatus(QuizStatus.PUBLISHED);

        when(quizRepository.findByQuizCode("123456")).thenReturn(Optional.of(quiz));
        when(quizRepository.findById(10L)).thenReturn(Optional.of(quiz));
        when(questionRepository.findByQuizIdOrderByDisplayOrder(10L)).thenReturn(List.of());

        var response = new StudentQuizService(
                quizRepository, questionRepository, optionRepository)
                .getQuizPackageByCode("123456");

        assertEquals(10L, response.quizId());
        verify(quizRepository).findByQuizCode("123456");
        verify(quizRepository).findById(10L);
    }

    private void setId(Object target, String fieldName, Long value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }
}
