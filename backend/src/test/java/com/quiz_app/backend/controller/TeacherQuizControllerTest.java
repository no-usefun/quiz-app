package com.quiz_app.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.TeacherQuizService;

@ExtendWith(MockitoExtension.class)
class TeacherQuizControllerTest {

    @Mock
    private TeacherQuizService teacherQuizService;

    @Mock
    private Authentication authentication;

    @Mock
    private CustomUserDetails userDetails;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {

        mockMvc = MockMvcBuilders
                .standaloneSetup(
                        new TeacherQuizController(
                                teacherQuizService))
                .build();

        when(authentication.getPrincipal())
                .thenReturn(userDetails);

        when(userDetails.getId())
                .thenReturn(2L);
    }

    @Test
    void publishQuiz_shouldCallTeacherQuizService()
            throws Exception {

        mockMvc.perform(
                put("/api/v1/teacher/quizzes/10/publish")
                        .principal(authentication))
                .andExpect(status().isNoContent());

        verify(teacherQuizService)
                .publishQuiz(10L, 2L);
    }

    @Test
    void publishResults_shouldCallService()
            throws Exception {

        mockMvc.perform(
                put("/api/v1/teacher/quizzes/10/results/publish")
                        .principal(authentication))
                .andExpect(status().isNoContent());

        verify(teacherQuizService)
                .publishResults(10L, 2L);
    }

    @Test
    void unpublishResults_shouldCallService()
            throws Exception {

        mockMvc.perform(
                put("/api/v1/teacher/quizzes/10/results/unpublish")
                        .principal(authentication))
                .andExpect(status().isNoContent());

        verify(teacherQuizService)
                .unpublishResults(10L, 2L);
    }

}