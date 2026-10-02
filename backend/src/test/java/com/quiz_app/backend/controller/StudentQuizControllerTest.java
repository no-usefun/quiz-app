package com.quiz_app.backend.controller;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.StudentAttemptService;
import com.quiz_app.backend.service.StudentQuizService;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class StudentQuizControllerTest {

    @Mock private StudentAttemptService attemptService;
    @Mock private StudentQuizService quizService;
    @Mock private Authentication authentication;
    @Mock private CustomUserDetails userDetails;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new StudentQuizController(attemptService, quizService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        when(authentication.getPrincipal()).thenReturn(userDetails);
        when(userDetails.getId()).thenReturn(1L);
    }

    @Test
    void startAttempt_shouldPassAuthenticatedStudentId() throws Exception {
        when(attemptService.startAttempt("123456", 1L))
                .thenReturn(new AttemptResponse(
                        1000L, 10L, 1L, LocalDateTime.now(), null,
                        AttemptStatus.IN_PROGRESS, 1, 0));

        mockMvc.perform(post("/api/v1/student/quizzes/123456/attempts")
                        .principal(authentication))
                .andExpect(status().isOk());

        verify(attemptService).startAttempt("123456", 1L);
    }

    @Test
    void submitAttempt_shouldPassAuthenticatedStudentId() throws Exception {
        when(attemptService.submitAttempt(
                eq(1000L), any(SubmitAttemptRequest.class), eq(1L)))
                .thenReturn(new SubmitAttemptResponse(
                        1000L, 10L, AttemptStatus.SUBMITTED,
                        BigDecimal.valueOf(5), BigDecimal.valueOf(5),
                        100, LocalDateTime.now()));

        mockMvc.perform(post("/api/v1/student/attempts/1000/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"answers":[]}")
                        .principal(authentication))
                .andExpect(status().isOk());

        verify(attemptService).submitAttempt(
                eq(1000L), any(SubmitAttemptRequest.class), eq(1L));
    }

    @Test
    void getQuizPackage_shouldDelegate() throws Exception {
        when(quizService.getQuizPackage(10L)).thenReturn(null);

        mockMvc.perform(get("/api/v1/student/quizzes/10/package"))
                .andExpect(status().isOk());

        verify(quizService).getQuizPackage(10L);
    }

    @Test
    void getQuizPackageByCode_shouldDelegate() throws Exception {
        when(quizService.getQuizPackageByCode("123456")).thenReturn(null);

        mockMvc.perform(get("/api/v1/student/quizzes/code/123456/package"))
                .andExpect(status().isOk());

        verify(quizService).getQuizPackageByCode("123456");
    }
}
