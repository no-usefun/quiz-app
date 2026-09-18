package com.quiz_app.backend.controller;

import java.math.BigDecimal;
import java.time.LocalDateTime;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.AttemptService;

@ExtendWith(MockitoExtension.class)
class AttemptControllerTest {

        @Mock
        private AttemptService attemptService;

        @Mock
        private Authentication authentication;

        @Mock
        private CustomUserDetails userDetails;

        private MockMvc mockMvc;

        @BeforeEach
        void setUp() {
                mockMvc = MockMvcBuilders
                                .standaloneSetup(
                                                new AttemptController(attemptService))
                                .setControllerAdvice(
                                                new GlobalExceptionHandler())
                                .build();

                when(authentication.getPrincipal())
                                .thenReturn(userDetails);

                when(userDetails.getId())
                                .thenReturn(1L);
        }

        @Test
        void startAttempt_shouldPassAuthenticatedStudentId() throws Exception {

                AttemptResponse response = new AttemptResponse(
                                1000L,
                                10L,
                                1L,
                                LocalDateTime.now(),
                                null,
                                AttemptStatus.IN_PROGRESS,
                                1,
                                0);

                when(attemptService.startAttempt(
                                "123456",
                                1L))
                                .thenReturn(response);

                mockMvc.perform(
                                post("/api/v1/quizzes/123456/attempts")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{}")
                                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(attemptService)
                                .startAttempt("123456", 1L);
        }

        @Test
        void submitAttempt_shouldPassAuthenticatedStudentId()
                        throws Exception {

                SubmitAttemptResponse response = new SubmitAttemptResponse(
                                1000L,
                                10L,
                                AttemptStatus.SUBMITTED,
                                BigDecimal.valueOf(5),
                                BigDecimal.valueOf(5),
                                100,
                                LocalDateTime.now());

                when(attemptService.submitAttempt(
                                eq(1000L),
                                any(SubmitAttemptRequest.class),
                                eq(1L)))
                                .thenReturn(response);

                mockMvc.perform(
                                post("/api/v1/attempts/1000/submit")
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("""
                                                                {
                                                                  "answers": [
                                                                    {
                                                                      "questionId": 100,
                                                                      "selectedOptionIds": [101],
                                                                      "responseTimeSeconds": 15
                                                                    }
                                                                  ]
                                                                }
                                                                """)
                                                .principal(authentication))
                                .andExpect(status().isOk());

                verify(attemptService)
                                .submitAttempt(
                                                eq(1000L),
                                                any(SubmitAttemptRequest.class),
                                                eq(1L));
        }
}