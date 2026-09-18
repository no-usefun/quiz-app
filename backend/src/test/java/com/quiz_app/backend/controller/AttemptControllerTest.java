package com.quiz_app.backend.controller;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SaveAnswerRequest;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.service.AttemptService;

@ExtendWith(MockitoExtension.class)
class AttemptControllerTest {

    @Mock
    private AttemptService attemptService;

    @InjectMocks
    private AttemptController attemptController;

    private AttemptResponse attemptResponse;
    private AnswerResponse answerResponse;

    @BeforeEach
    void setUp() {
        attemptResponse = new AttemptResponse(
                1000L,
                10L,
                1L,
                LocalDateTime.now(),
                null,
                AttemptStatus.IN_PROGRESS,
                1,
                0);

        answerResponse = new AnswerResponse(
                100L,
                1L,
                200L,
                List.of(301L),
                15,
                null);
    }

    @Test
    void startAttempt_shouldReturnCreatedResponse() {

        String quizCode = "123456";

        StartAttemptRequest request = new StartAttemptRequest(20L);

        when(attemptService.startAttempt(quizCode, request))
                .thenReturn(attemptResponse);

        ResponseEntity<AttemptResponse> response = attemptController.startAttempt(quizCode, request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertSame(attemptResponse, response.getBody());

        verify(attemptService).startAttempt(quizCode, request);
    }

    @Test
    void saveAnswer_shouldReturnOkResponse() {

        Long attemptId = 1L;
        Long questionId = 200L;

        SaveAnswerRequest request = new SaveAnswerRequest(
                List.of(301L),
                15);

        when(attemptService.saveAnswer(
                attemptId,
                questionId,
                request))
                .thenReturn(answerResponse);

        ResponseEntity<AnswerResponse> response = attemptController.saveAnswer(
                attemptId,
                questionId,
                request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertSame(answerResponse, response.getBody());

        verify(attemptService).saveAnswer(
                attemptId,
                questionId,
                request);
    }
}