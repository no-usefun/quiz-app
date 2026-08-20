package com.quiz_app.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.OptionRequest;
import com.quiz_app.backend.dto.quiz.QuestionRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.entity.Difficulty;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.QuestionType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class QuizServiceTest {

    @Mock
    private QuizRepository quizRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private OptionRepository optionRepository;

    @Mock
    private UserRepository userRepository;

    private QuizService quizService;

    @BeforeEach
    void setUp() {
        quizService = new QuizService(quizRepository, questionRepository, optionRepository, userRepository);
    }

    @Test
    void testCreateQuizSuccess() {
        Role teacherRole = new Role();
        teacherRole.setName("TEACHER");

        User teacher = new User();
        teacher.setRole(teacherRole);
        teacher.setFirstName("Alan");
        teacher.setLastName("Turing");
        teacher.setEmail("alan@university.edu");

        when(userRepository.findById(1L)).thenReturn(Optional.of(teacher));
        when(quizRepository.existsByQuizCode(any())).thenReturn(false);
        when(quizRepository.save(any(Quiz.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(questionRepository.save(any(Question.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(optionRepository.save(any(Option.class))).thenAnswer(invocation -> invocation.getArgument(0));

        List<OptionRequest> options = List.of(
                new OptionRequest("Stack", null, (short) 1, true),
                new OptionRequest("Queue", null, (short) 2, false),
                new OptionRequest("Tree", null, (short) 3, false),
                new OptionRequest("Graph", null, (short) 4, false)
        );

        List<QuestionRequest> questions = List.of(
                new QuestionRequest(
                        "Which data structure is LIFO?", null, "Stack is LIFO",
                        QuestionType.MCQ, BigDecimal.valueOf(2.0), BigDecimal.ZERO,
                        60, Difficulty.EASY, 1, options)
        );

        CreateQuizRequest request = new CreateQuizRequest(
                1L, "Data Structures Quiz", "Midterm Test", "Answer all questions",
                "Computer Science", "CS-101", 50, 1800,
                false, BigDecimal.ZERO, false, false, false,
                true, true, true,
                LocalDateTime.now().plusMinutes(5), LocalDateTime.now().plusHours(2),
                questions
        );

        QuizResponse response = quizService.createQuiz(request);

        assertNotNull(response);
        assertEquals("Data Structures Quiz", response.title());
        assertNotNull(response.quizCode());
        verify(quizRepository).save(any(Quiz.class));
    }
}
