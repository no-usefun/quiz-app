package com.quiz_app.backend.controller;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.quiz.UpdateQuizSettingsRequest;
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
        private ObjectMapper objectMapper;

        @BeforeEach
        void setUp() {
                mockMvc = MockMvcBuilders
                                .standaloneSetup(new TeacherQuizController(teacherQuizService))
                                .build();
                objectMapper = new ObjectMapper();

                when(authentication.getPrincipal()).thenReturn(userDetails);
                when(userDetails.getId()).thenReturn(2L);
        }

        @Test
        void publishQuiz_shouldCallService() throws Exception {
                mockMvc.perform(put("/api/v1/teacher/quizzes/10/publish")
                                .principal(authentication))
                                .andExpect(status().isNoContent());

                verify(teacherQuizService).publishQuiz(10L, 2L);
        }

        @Test
        void publishResults_shouldCallService() throws Exception {
                mockMvc.perform(put("/api/v1/teacher/quizzes/10/results/publish")
                                .principal(authentication))
                                .andExpect(status().isNoContent());

                verify(teacherQuizService).publishResults(10L, 2L);
        }

        @Test
        void unpublishResults_shouldCallService() throws Exception {
                mockMvc.perform(put("/api/v1/teacher/quizzes/10/results/unpublish")
                                .principal(authentication))
                                .andExpect(status().isNoContent());

                verify(teacherQuizService).unpublishResults(10L, 2L);
        }

        @Test
        void getTeacherQuizzes_shouldPassTeacherId() throws Exception {
                when(teacherQuizService.getTeacherQuizzes(2L)).thenReturn(List.of());

                mockMvc.perform(get("/api/v1/teacher/quizzes")
                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(teacherQuizService).getTeacherQuizzes(2L);
        }

        @Test
        void updateQuizSettings_shouldPassRequestAndTeacherId() throws Exception {
                UpdateQuizSettingsRequest request = new UpdateQuizSettingsRequest(
                                null, null, null, null, null, null, null, null, null,
                                null, null, null, null, null, null, null);

                when(teacherQuizService.updateQuizSettings(
                                eq(10L), eq(2L), any(UpdateQuizSettingsRequest.class)))
                                .thenReturn(null);

                mockMvc.perform(put("/api/v1/teacher/quizzes/10/settings")
                                .principal(authentication)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                                .andExpect(status().isOk());

                verify(teacherQuizService).updateQuizSettings(
                                eq(10L), eq(2L), any(UpdateQuizSettingsRequest.class));
        }

        @Test
        void completeQuiz_shouldPassTeacherId() throws Exception {
                when(teacherQuizService.completeQuiz(10L, 2L)).thenReturn(null);

                mockMvc.perform(put("/api/v1/teacher/quizzes/10/complete")
                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(teacherQuizService).completeQuiz(10L, 2L);
        }

        @Test
        void getTeacherQuizDetail_shouldPassTeacherId() throws Exception {
                when(teacherQuizService.getTeacherQuizDetail(10L, 2L)).thenReturn(null);

                mockMvc.perform(get("/api/v1/teacher/quizzes/10")
                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(teacherQuizService).getTeacherQuizDetail(10L, 2L);
        }

        @Test
        void getLeaderboard_shouldPassTeacherId() throws Exception {
                when(teacherQuizService.getLeaderboard(10L, 2L)).thenReturn(List.of());

                mockMvc.perform(get("/api/v1/teacher/quizzes/10/leaderboard")
                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(teacherQuizService).getLeaderboard(10L, 2L);
        }
}
