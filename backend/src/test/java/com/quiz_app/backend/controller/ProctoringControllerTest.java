package com.quiz_app.backend.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.quiz_app.backend.dto.proctoring.ActivityLogResponse;
import com.quiz_app.backend.dto.proctoring.BatchLogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityResponse;
import com.quiz_app.backend.dto.proctoring.ProctoringSummaryResponse;
import com.quiz_app.backend.dto.proctoring.QuizProctoringOverviewResponse;
import com.quiz_app.backend.dto.proctoring.RegisterDeviceRequest;
import com.quiz_app.backend.entity.ActivityType;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.DeviceType;
import com.quiz_app.backend.exception.GlobalExceptionHandler;
import com.quiz_app.backend.service.ProctoringService;

@ExtendWith(MockitoExtension.class)
class ProctoringControllerTest {

    private MockMvc mockMvc;

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private ProctoringService proctoringService;

    @InjectMocks
    private ProctoringController proctoringController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(proctoringController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void testLogActivityEndpoint() throws Exception {
        LogActivityRequest request = new LogActivityRequest(
                1L, ActivityType.TAB_SWITCH, "Switched window", LocalDateTime.now());

        LogActivityResponse response = new LogActivityResponse(
                true, 1, 3, false, false, "Activity recorded successfully");

        when(proctoringService.recordActivity(eq(100L), any(LogActivityRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/attempts/100/activities")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.currentWarningsCount").value(1))
                .andExpect(jsonPath("$.warningExceeded").value(false));
    }

    @Test
    void testLogBatchActivitiesEndpoint() throws Exception {
        List<LogActivityRequest> events = List.of(
                new LogActivityRequest(1L, ActivityType.FULLSCREEN_EXIT, "Exited fullscreen", LocalDateTime.now())
        );
        BatchLogActivityRequest batchRequest = new BatchLogActivityRequest(events);

        LogActivityResponse response = new LogActivityResponse(
                true, 1, 3, false, false, "Batch processed");

        when(proctoringService.recordBatchActivities(eq(100L), any(BatchLogActivityRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/v1/attempts/100/activities/batch")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(batchRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testRegisterDeviceEndpoint() throws Exception {
        RegisterDeviceRequest request = new RegisterDeviceRequest(
                "10.0.0.1", "Firefox", "121.0", "macOS",
                DeviceType.LAPTOP, 2560, 1440, "Mozilla/5.0..."
        );

        mockMvc.perform(post("/api/v1/attempts/100/device")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testGetAttemptLogsEndpoint() throws Exception {
        ActivityLogResponse logResponse = new ActivityLogResponse(
                1L, 100L, null, ActivityType.START_QUIZ, LocalDateTime.now(), "Started exam", false);

        when(proctoringService.getAttemptLogs(100L)).thenReturn(List.of(logResponse));

        mockMvc.perform(get("/api/v1/teacher/attempts/100/proctoring-logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].activityType").value("START_QUIZ"));
    }

    @Test
    void testUploadIdPhotoEndpoint() throws Exception {
        mockMvc.perform(post("/api/v1/attempts/100/id-photo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"idPhotoData\":\"data:image/jpeg;base64,mockphotodata\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }

    @Test
    void testGetAttemptSummaryEndpoint() throws Exception {
        ProctoringSummaryResponse summary = new ProctoringSummaryResponse(
                100L, 5L, "Bob Ross", "bob@art.edu", AttemptStatus.IN_PROGRESS,
                1, 1, 0, 0, 0, true, "data:image/jpeg;base64,sampleid", Collections.emptyList());

        when(proctoringService.getAttemptSummary(100L)).thenReturn(summary);

        mockMvc.perform(get("/api/v1/teacher/attempts/100/proctoring-summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.studentName").value("Bob Ross"))
                .andExpect(jsonPath("$.tabSwitches").value(1))
                .andExpect(jsonPath("$.isIntegrityFlagged").value(true))
                .andExpect(jsonPath("$.idPhotoData").value("data:image/jpeg;base64,sampleid"));
    }

    @Test
    void testGetQuizProctoringOverviewEndpoint() throws Exception {
        QuizProctoringOverviewResponse overview = new QuizProctoringOverviewResponse(
                50L, "Physics Final", "PHYS-201", 10, 8, 2, 5, Collections.emptyList());

        when(proctoringService.getQuizProctoringOverview(50L)).thenReturn(overview);

        mockMvc.perform(get("/api/v1/teacher/quizzes/50/proctoring-overview"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.quizTitle").value("Physics Final"))
                .andExpect(jsonPath("$.flaggedAttempts").value(2));
    }
}
