package com.quiz_app.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.proctoring.ActivityLogResponse;
import com.quiz_app.backend.dto.proctoring.BatchLogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityRequest;
import com.quiz_app.backend.dto.proctoring.LogActivityResponse;
import com.quiz_app.backend.dto.proctoring.ProctoringSummaryResponse;
import com.quiz_app.backend.dto.proctoring.QuizProctoringOverviewResponse;
import com.quiz_app.backend.dto.proctoring.RegisterDeviceRequest;
import com.quiz_app.backend.entity.ActivityLog;
import com.quiz_app.backend.entity.ActivityType;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Device;
import com.quiz_app.backend.entity.DeviceType;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.repository.ActivityLogRepository;
import com.quiz_app.backend.repository.DeviceRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;

@ExtendWith(MockitoExtension.class)
class ProctoringServiceTest {

    @Mock
    private QuizAttemptRepository quizAttemptRepository;

    @Mock
    private ActivityLogRepository activityLogRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private QuestionRepository questionRepository;

    @Mock
    private QuizRepository quizRepository;

    private ProctoringService proctoringService;

    @BeforeEach
    void setUp() {
        proctoringService = new ProctoringService(
                quizAttemptRepository,
                activityLogRepository,
                deviceRepository,
                questionRepository,
                quizRepository
        );
    }

    @Test
    void testRecordNonViolationActivity() {
        QuizAttempt attempt = new QuizAttempt();
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(0);

        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));

        LogActivityRequest request = new LogActivityRequest(
                10L, ActivityType.VIEW_QUESTION, "Viewing Q1", LocalDateTime.now());

        LogActivityResponse response = proctoringService.recordActivity(1L, request);

        assertNotNull(response);
        assertTrue(response.success());
        assertEquals(0, response.currentWarningsCount());
        assertFalse(response.warningExceeded());
        assertFalse(response.autoSubmitted());
        verify(activityLogRepository).save(any(ActivityLog.class));
    }

    @Test
    void testRecordViolationActivityIncrementsWarning() {
        Quiz quiz = new Quiz();
        quiz.setMaxTabSwitch(3);
        quiz.setAutoSubmit(true);

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuiz(quiz);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(1);

        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));

        LogActivityRequest request = new LogActivityRequest(
                null, ActivityType.TAB_SWITCH, "Switched to background tab", LocalDateTime.now());

        LogActivityResponse response = proctoringService.recordActivity(1L, request);

        assertNotNull(response);
        assertTrue(response.success());
        assertEquals(2, response.currentWarningsCount());
        assertFalse(response.warningExceeded());
        assertFalse(response.autoSubmitted());
        verify(quizAttemptRepository).save(attempt);
    }

    @Test
    void testRecordEdgeAIViolationTriggersAutoSubmitWhenThresholdExceeded() {
        Quiz quiz = new Quiz();
        quiz.setMaxTabSwitch(3);
        quiz.setAutoSubmit(true);

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuiz(quiz);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(2); // Next violation will hit 3

        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));

        LogActivityRequest request = new LogActivityRequest(
                null, ActivityType.MULTIPLE_FACES, "Two people detected in webcam feed", LocalDateTime.now());

        LogActivityResponse response = proctoringService.recordActivity(1L, request);

        assertNotNull(response);
        assertEquals(3, response.currentWarningsCount());
        assertTrue(response.warningExceeded());
        assertTrue(response.autoSubmitted());
        assertEquals(AttemptStatus.AUTO_SUBMITTED, attempt.getStatus());
        assertNotNull(attempt.getSubmittedAt());
    }

    @Test
    void testRecordBatchActivities() {
        Quiz quiz = new Quiz();
        quiz.setMaxTabSwitch(5);
        quiz.setAutoSubmit(false);

        QuizAttempt attempt = new QuizAttempt();
        attempt.setQuiz(quiz);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(0);

        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));

        List<LogActivityRequest> events = List.of(
                new LogActivityRequest(null, ActivityType.WINDOW_BLUR, "Window blur", LocalDateTime.now()),
                new LogActivityRequest(null, ActivityType.FACE_NOT_DETECTED, "Face not in frame", LocalDateTime.now())
        );

        BatchLogActivityRequest batchRequest = new BatchLogActivityRequest(events);
        LogActivityResponse response = proctoringService.recordBatchActivities(1L, batchRequest);

        assertNotNull(response);
        assertEquals(2, response.currentWarningsCount());
    }

    @Test
    void testRegisterDevice() {
        QuizAttempt attempt = new QuizAttempt();
        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));

        RegisterDeviceRequest request = new RegisterDeviceRequest(
                "192.168.1.50", "Chrome", "120.0", "Windows 11",
                DeviceType.LAPTOP, 1920, 1080, "Mozilla/5.0..."
        );

        proctoringService.registerDevice(1L, request);

        verify(deviceRepository).save(any(Device.class));
        verify(activityLogRepository).save(any(ActivityLog.class));
    }

    @Test
    void testGetAttemptSummary() {
        User student = new User();
        student.setFirstName("Sarah");
        student.setLastName("Connor");
        student.setEmail("sarah@university.edu");

        QuizAttempt attempt = new QuizAttempt();
        attempt.setStudent(student);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(3);

        when(quizAttemptRepository.findById(1L)).thenReturn(Optional.of(attempt));
        when(activityLogRepository.countByAttemptIdAndActivityType(1L, ActivityType.TAB_SWITCH)).thenReturn(2L);
        when(activityLogRepository.countByAttemptIdAndActivityType(1L, ActivityType.FULLSCREEN_EXIT)).thenReturn(1L);
        when(activityLogRepository.countByAttemptIdAndActivityTypeIn(any(), any())).thenReturn(3L);

        ProctoringSummaryResponse summary = proctoringService.getAttemptSummary(1L);

        assertNotNull(summary);
        assertEquals("Sarah Connor", summary.studentName());
        assertEquals(2, summary.tabSwitches());
        assertEquals(1, summary.fullscreenExits());
        assertTrue(summary.isIntegrityFlagged());
    }

    @Test
    void testGetQuizProctoringOverview() {
        Quiz quiz = new Quiz();
        quiz.setTitle("Calculus I");
        quiz.setQuizCode("MATH101");

        User student = new User();
        student.setFirstName("John");
        student.setEmail("john@test.com");

        QuizAttempt attempt = new QuizAttempt();
        attempt.setStudent(student);
        attempt.setStatus(AttemptStatus.IN_PROGRESS);
        attempt.setWarningsCount(1);

        when(quizRepository.findById(10L)).thenReturn(Optional.of(quiz));
        when(quizAttemptRepository.findByQuizId(10L)).thenReturn(List.of(attempt));
        when(quizAttemptRepository.findById(any())).thenReturn(Optional.of(attempt));

        QuizProctoringOverviewResponse overview = proctoringService.getQuizProctoringOverview(10L);

        assertNotNull(overview);
        assertEquals("Calculus I", overview.quizTitle());
        assertEquals("MATH101", overview.quizCode());
        assertEquals(1, overview.totalAttempts());
        assertEquals(1, overview.inProgressAttempts());
    }
}
