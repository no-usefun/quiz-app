package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import com.quiz_app.backend.dto.quiz.UpdateQuizSettingsRequest;
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
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizRepository;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TeacherQuizServiceTest {

        @Mock
        private QuizRepository quizRepository;

        @Mock
        private QuestionRepository questionRepository;

        @Mock
        private OptionRepository optionRepository;

        @Mock
        private QuizAllowedStudentRepository quizAllowedStudentRepository;

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

        // ============================================================
        // PUBLISH QUIZ
        // ============================================================

        @Test
        void publishQuiz_shouldPublishDraftQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                teacherQuizService.publishQuiz(10L, 2L);

                verify(quiz).setTotalQuestions(1);
                verify(quiz).setTotalMarks(BigDecimal.ONE);
                verify(quiz).setStatus(QuizStatus.PUBLISHED);
                verify(quiz).setExamState(ExamState.WAITING);
                verify(quiz).setUpdatedAt(any(LocalDateTime.class));
                verify(quizRepository).save(quiz);
        }

        @Test
        void publishQuiz_shouldRejectNullQuizId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(null, 2L));

                verify(quizRepository, never()).findById(any());
        }

        @Test
        void publishQuiz_shouldRejectNullTeacherId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, null));

                verify(quizRepository, never()).findById(any());
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
        void publishQuiz_shouldRejectQuizWithoutTeacher() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getTeacher()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));

                verify(quizRepository, never()).save(any());
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

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of());

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectNullQuestionList() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMissingQuestionType() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionType()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectQuestionWithoutTextOrImage() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionText()).thenReturn(" ");
                when(question.getImageUrl()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldAcceptQuestionWithImageOnly() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionText()).thenReturn(null);
                when(question.getImageUrl()).thenReturn("question.png");

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                teacherQuizService.publishQuiz(10L, 2L);

                verify(quiz).setStatus(QuizStatus.PUBLISHED);
        }

        @Test
        void publishQuiz_shouldRejectZeroQuestionMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getMarks()).thenReturn(BigDecimal.ZERO);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectNullQuestionMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getMarks()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectNegativeQuestionMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getNegativeMarks())
                                .thenReturn(BigDecimal.ONE.negate());

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectInvalidQuestionDisplayOrder() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getDisplayOrder()).thenReturn(0);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectQuestionWithoutOptions() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of());

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectNullOptions() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMcqWithoutCorrectOption() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option1.isCorrect()).thenReturn(false);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMcqWithMultipleCorrectOptions() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option2.isCorrect()).thenReturn(true);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMsqWithoutCorrectOption() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionType()).thenReturn(QuestionType.MSQ);
                when(option1.isCorrect()).thenReturn(false);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldAcceptMsqWithMultipleCorrectOptions() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionType()).thenReturn(QuestionType.MSQ);
                when(option2.isCorrect()).thenReturn(true);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                teacherQuizService.publishQuiz(10L, 2L);

                verify(quiz).setStatus(QuizStatus.PUBLISHED);
        }

        @Test
        void publishQuiz_shouldRejectTrueFalseWithWrongOptionCount() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionType())
                                .thenReturn(QuestionType.TRUE_FALSE);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectTrueFalseWithMultipleCorrectOptions() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getQuestionType())
                                .thenReturn(QuestionType.TRUE_FALSE);

                when(option2.isCorrect()).thenReturn(true);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectOptionWithoutTextOrImage() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option1.getOptionText()).thenReturn(" ");
                when(option1.getOptionImage()).thenReturn(null);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldAcceptOptionWithImageOnly() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option1.getOptionText()).thenReturn(null);
                when(option1.getOptionImage()).thenReturn("option.png");

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                teacherQuizService.publishQuiz(10L, 2L);

                verify(quiz).setStatus(QuizStatus.PUBLISHED);
        }

        @Test
        void publishQuiz_shouldRejectInvalidOptionOrder() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option1.getOptionOrder()).thenReturn((short) 0);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectDuplicateOptionOrders() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(option2.getOptionOrder()).thenReturn((short) 1);

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectInvalidTimer() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(quiz.getOverallTimerSeconds()).thenReturn(0);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMissingStartTime() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(quiz.getStartTime()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectMissingEndTime() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(quiz.getEndTime()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectEndBeforeStart() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
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
        void publishQuiz_shouldRejectInvalidNegativeMarkingConfiguration() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(quiz.isNegativeMarking()).thenReturn(true);
                when(quiz.getNegativeMarks()).thenReturn(null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectNegativeQuizNegativeMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(quiz.isNegativeMarking()).thenReturn(true);
                when(quiz.getNegativeMarks())
                                .thenReturn(BigDecimal.ONE.negate());

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        @Test
        void publishQuiz_shouldRejectZeroTotalMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(question.getMarks()).thenReturn(BigDecimal.ZERO);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishQuiz(10L, 2L));
        }

        // ============================================================
        // PUBLISH RESULTS
        // ============================================================

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
        void publishResults_shouldRejectMissingQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> teacherQuizService.publishResults(10L, 2L));
        }

        @Test
        void publishResults_shouldRejectUnauthorizedTeacher() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(teacher.getId()).thenReturn(999L);
                when(quiz.getStatus()).thenReturn(QuizStatus.COMPLETED);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishResults(10L, 2L));

                verify(quizRepository, never()).save(any());
        }

        @Test
        void publishResults_shouldRejectIncompleteQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus()).thenReturn(QuizStatus.PUBLISHED);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.publishResults(10L, 2L));

                verify(quizRepository, never()).save(any());
        }

        // ============================================================
        // UNPUBLISH RESULTS
        // ============================================================

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

        @Test
        void unpublishResults_shouldRejectMissingQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> teacherQuizService.unpublishResults(10L, 2L));
        }

        @Test
        void unpublishResults_shouldRejectUnauthorizedTeacher() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(teacher.getId()).thenReturn(999L);
                when(quiz.getStatus()).thenReturn(QuizStatus.COMPLETED);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.unpublishResults(10L, 2L));

                verify(quizRepository, never()).save(any());
        }

        @Test
        void unpublishResults_shouldRejectIncompleteQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus()).thenReturn(QuizStatus.PUBLISHED);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.unpublishResults(10L, 2L));

                verify(quizRepository, never()).save(any());
        }

        // ============================================================
        // GET TEACHER QUIZZES
        // ============================================================

        @Test
        void getTeacherQuizzes_shouldRejectNullTeacherId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.getTeacherQuizzes(null));
        }

        @Test
        void getTeacherQuizzes_shouldReturnTeacherQuizzes() {

                when(quizRepository.findByTeacherIdOrderByCreatedAtDesc(2L))
                                .thenReturn(List.of(quiz));

                when(quizAllowedStudentRepository.findByQuizId(10L))
                                .thenReturn(List.of());

                var result = teacherQuizService.getTeacherQuizzes(2L);

                assertEquals(1, result.size());
        }

        @Test
        void getTeacherQuizzes_shouldReturnEmptyListWhenNoQuizzesExist() {

                when(quizRepository.findByTeacherIdOrderByCreatedAtDesc(2L))
                                .thenReturn(List.of());

                var result = teacherQuizService.getTeacherQuizzes(2L);

                assertEquals(0, result.size());
        }

        // ============================================================
        // UPDATE QUIZ SETTINGS
        // ============================================================

        private UpdateQuizSettingsRequest emptySettingsRequest() {

                return new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null);
        }

        @Test
        void updateQuizSettings_shouldRejectNullQuizId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                null,
                                                2L,
                                                emptySettingsRequest()));
        }

        @Test
        void updateQuizSettings_shouldRejectNullTeacherId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                null,
                                                emptySettingsRequest()));
        }

        @Test
        void updateQuizSettings_shouldRejectNullRequest() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                null));
        }

        @Test
        void updateQuizSettings_shouldRejectMissingQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                emptySettingsRequest()));
        }

        @Test
        void updateQuizSettings_shouldRejectUnauthorizedTeacher() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(teacher.getId()).thenReturn(999L);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                emptySettingsRequest()));

                verify(quizRepository, never()).save(any());
        }

        @Test
        void updateQuizSettings_shouldRejectNonDraftQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus()).thenReturn(QuizStatus.PUBLISHED);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                emptySettingsRequest()));
        }

        @Test
        void updateQuizSettings_shouldUpdateBasicSettings() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quizRepository.save(quiz))
                                .thenReturn(quiz);

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                3600,
                                true,
                                BigDecimal.ONE,
                                true,
                                true,
                                true,
                                true,
                                true,
                                true,
                                3,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null);

                var response = teacherQuizService.updateQuizSettings(
                                10L,
                                2L,
                                request);

                verify(quiz).setOverallTimerSeconds(3600);
                verify(quiz).setNegativeMarking(true);
                verify(quiz).setNegativeMarks(BigDecimal.ONE);
                verify(quiz).setTimeBonusEnabled(true);
                verify(quiz).setRandomQuestionOrder(true);
                verify(quiz).setRandomOptionOrder(true);
                verify(quiz).setAllowReview(true);
                verify(quiz).setAllowResume(true);
                verify(quiz).setAutoSubmit(true);
                verify(quiz).setMaxTabSwitch(3);
                verify(quiz).setUpdatedAt(any(LocalDateTime.class));
                verify(quizRepository).save(quiz);

                assertEquals(10L, response.quizId());
        }

        @Test
        void updateQuizSettings_shouldRejectInvalidTimer() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                0,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                request));
        }

        @Test
        void updateQuizSettings_shouldRejectNegativeMarks() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                BigDecimal.ONE.negate(),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                request));
        }

        @Test
        void updateQuizSettings_shouldRejectNegativeMaxTabSwitch() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                -1,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                request));
        }

        @Test
        void updateQuizSettings_shouldRejectEndTimeBeforeStartTime() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                LocalDateTime start = LocalDateTime.now().plusHours(2);
                LocalDateTime end = LocalDateTime.now().plusHours(1);

                when(quiz.getStartTime()).thenReturn(start);
                when(quiz.getEndTime()).thenReturn(end);

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                start,
                                end,
                                null,
                                null,
                                null,
                                null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                request));
        }

        @Test
        void updateQuizSettings_shouldRejectInvalidAcceptedEmailDomain() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "vit.ac.in",
                                null,
                                null);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.updateQuizSettings(
                                                10L,
                                                2L,
                                                request));
        }

        @Test
        void updateQuizSettings_shouldNormalizeAcceptedEmailDomain() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quizRepository.save(quiz))
                                .thenReturn(quiz);

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                " @VIT.AC.IN ",
                                null,
                                null);

                teacherQuizService.updateQuizSettings(
                                10L,
                                2L,
                                request);

                verify(quiz).setAcceptedEmailDomain("@vit.ac.in");
        }

        @Test
        void updateQuizSettings_shouldAllowBlankAcceptedEmailDomain() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quizRepository.save(quiz))
                                .thenReturn(quiz);

                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                null,
                                "   ",
                                null,
                                null);

                teacherQuizService.updateQuizSettings(
                                10L,
                                2L,
                                request);

                verify(quiz).setAcceptedEmailDomain(null);
        }

        // ============================================================
        // COMPLETE QUIZ
        // ============================================================

        @Test
        void completeQuiz_shouldCompletePublishedQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus())
                                .thenReturn(QuizStatus.PUBLISHED);

                when(quizRepository.save(quiz))
                                .thenReturn(quiz);

                var response = teacherQuizService.completeQuiz(10L, 2L);

                verify(quiz).setStatus(QuizStatus.COMPLETED);
                verify(quiz).setExamState(ExamState.ENDED);
                verify(quiz).setUpdatedAt(any(LocalDateTime.class));
                verify(quizRepository).save(quiz);

                assertEquals(10L, response.quizId());
        }

        @Test
        void completeQuiz_shouldRejectNullQuizId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.completeQuiz(null, 2L));
        }

        @Test
        void completeQuiz_shouldRejectNullTeacherId() {

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.completeQuiz(10L, null));
        }

        @Test
        void completeQuiz_shouldRejectMissingQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.empty());

                assertThrows(
                                ResourceNotFoundException.class,
                                () -> teacherQuizService.completeQuiz(10L, 2L));
        }

        @Test
        void completeQuiz_shouldRejectUnauthorizedTeacher() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(teacher.getId()).thenReturn(999L);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.completeQuiz(10L, 2L));

                verify(quizRepository, never()).save(any());
        }

        @Test
        void completeQuiz_shouldRejectNonPublishedQuiz() {

                when(quizRepository.findById(10L))
                                .thenReturn(Optional.of(quiz));

                when(quiz.getStatus())
                                .thenReturn(QuizStatus.DRAFT);

                assertThrows(
                                BadRequestException.class,
                                () -> teacherQuizService.completeQuiz(10L, 2L));

                verify(quizRepository, never()).save(any());
        }
}