package com.quiz_app.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.QuizService;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class QuizControllerTest {

        @Mock
        private QuizService quizService;

        @Mock
        private Authentication authentication;

        @Mock
        private CustomUserDetails userDetails;

        private MockMvc mockMvc;

        @BeforeEach
        void setUp() {

                mockMvc = MockMvcBuilders
                                .standaloneSetup(
                                                new QuizController(quizService))
                                .build();

                when(authentication.getPrincipal())
                                .thenReturn(userDetails);

                when(userDetails.getId())
                                .thenReturn(2L);
        }

        @Test
        void createQuiz_shouldPassAuthenticatedTeacherId()
                        throws Exception {

                when(quizService.createQuiz(
                                any(CreateQuizRequest.class),
                                eq(2L)))
                                .thenReturn(mock(QuizResponse.class));

                mockMvc.perform(
                                post("/api/v1/teacher/quizzes")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{}")
                                                .principal(authentication))
                                .andExpect(status().isCreated());

                verify(quizService)
                                .createQuiz(
                                                any(CreateQuizRequest.class),
                                                eq(2L));
        }

        @Test
        void getQuizPackage_shouldReturnPackage()
                        throws Exception {

                when(quizService.getQuizPackage(10L))
                                .thenReturn(mock(QuizPackageResponse.class));

                mockMvc.perform(
                                get("/api/v1/quizzes/10/package"))
                                .andExpect(status().isOk());

                verify(quizService)
                                .getQuizPackage(10L);
        }

        @Test
        void getQuizPackageByCode_shouldReturnPackage()
                        throws Exception {

                when(quizService.getQuizPackageByCode("123456"))
                                .thenReturn(mock(QuizPackageResponse.class));

                mockMvc.perform(
                                get("/api/v1/quizzes/code/123456/package"))
                                .andExpect(status().isOk());

                verify(quizService)
                                .getQuizPackageByCode("123456");
        }
}
