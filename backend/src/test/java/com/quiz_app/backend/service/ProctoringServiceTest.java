package com.quiz_app.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.proctoring.ProctoringEventRequest;
import com.quiz_app.backend.dto.proctoring.ProctoringEventResponse;
import com.quiz_app.backend.dto.proctoring.ProctoringSummaryRequest;
import com.quiz_app.backend.dto.proctoring.TeacherProctoringReportResponse;
import com.quiz_app.backend.dto.proctoring.TeacherQuizProctoringOverviewResponse;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizAttemptProctoringEvent;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.repository.QuizAttemptProctoringEventRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;

@ExtendWith(MockitoExtension.class)
class ProctoringServiceTest {

    @Mock
    private QuizAttemptRepository quizAttemptRepository;

    @Mock
    private QuizAttemptProctoringEventRepository proctoringEventRepository;

    @Mock
    private QuizRepository quizRepository;

    @Mock
    private StudentAttemptService studentAttemptService;

    @InjectMocks
    private ProctoringService proctoringService;

    private QuizAttempt testAttempt;
    private User testStudent;
    private User testTeacher;
    private Quiz testQuiz;

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        testStudent = new User();
        setField(testStudent, "id", 10L);
        testStudent.setFirstName("John");
        testStudent.setLastName("Doe");
        testStudent.setEmail("john@example.com");

        testTeacher = new User();
        setField(testTeacher, "id", 20L);

        testQuiz = new Quiz();
        setField(testQuiz, "id", 1L);
        testQuiz.setQuizCode("CS101");
        testQuiz.setTitle("Computer Science Basics");
        testQuiz.setTeacher(testTeacher);

        testAttempt = new QuizAttempt();
        setField(testAttempt, "id", 100L);
        testAttempt.setQuiz(testQuiz);
        testAttempt.setStudent(testStudent);
        testAttempt.setStatus(AttemptStatus.IN_PROGRESS);
        testAttempt.setWarningsCount(0);
        testAttempt.setStartedAt(LocalDateTime.now().minusMinutes(10));
    }

    @Test
    void testRecordProctoringEvent_IncrementsWarningOne() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(quizAttemptRepository.save(any(QuizAttempt.class))).thenReturn(testAttempt);

        ProctoringEventRequest request = new ProctoringEventRequest("PHONE_DETECTED", "Mobile phone visible", "CRITICAL", 0.95, null);
        ProctoringEventResponse response = proctoringService.recordProctoringEvent(100L, request, 10L);

        assertNotNull(response);
        assertTrue(response.recorded());
        assertEquals(1, response.warningCount());
        assertFalse(response.autoSubmitted());
        verify(proctoringEventRepository).save(any(QuizAttemptProctoringEvent.class));
    }

    @Test
    void testRecordProctoringEvent_IncrementsWarningTwo() {
        testAttempt.setWarningsCount(1);
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(quizAttemptRepository.save(any(QuizAttempt.class))).thenReturn(testAttempt);

        ProctoringEventRequest request = new ProctoringEventRequest("LOOKING_AWAY", "Gaze deviation left", "HIGH", 0.90, null);
        ProctoringEventResponse response = proctoringService.recordProctoringEvent(100L, request, 10L);

        assertNotNull(response);
        assertTrue(response.recorded());
        assertEquals(2, response.warningCount());
        assertFalse(response.autoSubmitted());
    }

    @Test
    void testRecordProctoringEvent_AutoSubmitsOnThirdWarning() {
        testAttempt.setWarningsCount(2);
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(quizAttemptRepository.save(any(QuizAttempt.class))).thenReturn(testAttempt);

        ProctoringEventRequest request = new ProctoringEventRequest("IDENTITY_MISMATCH", "Different face detected", "CRITICAL", 0.92, null);
        ProctoringEventResponse response = proctoringService.recordProctoringEvent(100L, request, 10L);

        assertNotNull(response);
        assertTrue(response.recorded());
        assertEquals(3, response.warningCount());
        assertTrue(response.autoSubmitted());
        assertEquals("MALPRACTICE_WARNING_LIMIT", testAttempt.getTerminationReason());
        assertEquals(AttemptStatus.AUTO_SUBMITTED, testAttempt.getStatus());
        assertNotNull(testAttempt.getSubmittedAt());
    }

    @Test
    void testRecordProctoringEvent_RejectsFourthEventAfterAutoSubmit() {
        testAttempt.setStatus(AttemptStatus.AUTO_SUBMITTED);
        testAttempt.setWarningsCount(3);
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        ProctoringEventRequest request = new ProctoringEventRequest("PHONE_DETECTED", "Phone after submit", "CRITICAL", 0.95, null);
        ProctoringEventResponse response = proctoringService.recordProctoringEvent(100L, request, 10L);

        assertNotNull(response);
        assertFalse(response.recorded());
        assertEquals(3, response.warningCount());
        assertTrue(response.autoSubmitted());
    }

    @Test
    void testRecordProctoringEvent_DebouncesDuplicateWithinWindow() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(quizAttemptRepository.save(any(QuizAttempt.class))).thenReturn(testAttempt);

        ProctoringEventRequest request = new ProctoringEventRequest("VOICE_ACTIVITY", "Speech detected", "MEDIUM", 0.85, null);
        ProctoringEventResponse response1 = proctoringService.recordProctoringEvent(100L, request, 10L);
        assertTrue(response1.recorded());
        assertEquals(1, response1.warningCount());

        // Duplicate event within debounce interval
        ProctoringEventResponse response2 = proctoringService.recordProctoringEvent(100L, request, 10L);
        assertFalse(response2.recorded());
        assertEquals(1, response2.warningCount());
    }

    @Test
    void testRecordProctoringEvent_AllowsDifferentEventTypesWithinDebounce() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(quizAttemptRepository.save(any(QuizAttempt.class))).thenReturn(testAttempt);

        ProctoringEventRequest req1 = new ProctoringEventRequest("MULTIPLE_PERSONS", "Two persons in room", "HIGH", 0.95, null);
        ProctoringEventResponse resp1 = proctoringService.recordProctoringEvent(100L, req1, 10L);
        assertTrue(resp1.recorded());
        assertEquals(1, resp1.warningCount());

        ProctoringEventRequest req2 = new ProctoringEventRequest("PHONE_DETECTED", "Phone in hand", "CRITICAL", 0.95, null);
        ProctoringEventResponse resp2 = proctoringService.recordProctoringEvent(100L, req2, 10L);
        assertTrue(resp2.recorded());
        assertEquals(2, resp2.warningCount());
    }

    @Test
    void testGetAttemptProctoringReport_UsesRealVerificationData_NoDoubleCounting() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        QuizAttemptProctoringEvent evSummary = new QuizAttemptProctoringEvent();
        setField(evSummary, "id", 1L);
        evSummary.setEventType("SESSION_SUMMARY");
        evSummary.setMetadataJson("{\"totalFaceChecks\":42,\"identityMatches\":40,\"identityMismatches\":2}");
        evSummary.setOccurredAt(LocalDateTime.now().minusMinutes(1));

        QuizAttemptProctoringEvent evPhone = new QuizAttemptProctoringEvent();
        setField(evPhone, "id", 2L);
        evPhone.setEventType("PHONE_DETECTED");
        evPhone.setMetadataJson("{\"details\":\"Phone detected\",\"severity\":\"CRITICAL\",\"confidence\":0.95}");
        evPhone.setOccurredAt(LocalDateTime.now().minusMinutes(5));

        QuizAttemptProctoringEvent evGaze = new QuizAttemptProctoringEvent();
        setField(evGaze, "id", 3L);
        evGaze.setEventType("LOOKING_AWAY");
        evGaze.setMetadataJson("{\"details\":\"Looking left\",\"severity\":\"HIGH\",\"confidence\":0.90}");
        evGaze.setOccurredAt(LocalDateTime.now().minusMinutes(4));

        QuizAttemptProctoringEvent evMismatch1 = new QuizAttemptProctoringEvent();
        setField(evMismatch1, "id", 4L);
        evMismatch1.setEventType("IDENTITY_MISMATCH");
        evMismatch1.setMetadataJson("{\"details\":\"Biometric mismatch\",\"severity\":\"CRITICAL\",\"confidence\":0.92}");
        evMismatch1.setOccurredAt(LocalDateTime.now().minusMinutes(3));

        QuizAttemptProctoringEvent evMismatch2 = new QuizAttemptProctoringEvent();
        setField(evMismatch2, "id", 5L);
        evMismatch2.setEventType("IDENTITY_MISMATCH");
        evMismatch2.setMetadataJson("{\"details\":\"Biometric mismatch #2\",\"severity\":\"CRITICAL\",\"confidence\":0.94}");
        evMismatch2.setOccurredAt(LocalDateTime.now().minusMinutes(2));

        when(proctoringEventRepository.findByAttemptId(100L))
                .thenReturn(List.of(evSummary, evPhone, evGaze, evMismatch1, evMismatch2));

        TeacherProctoringReportResponse report = proctoringService.getAttemptProctoringReport(100L, 20L);

        assertNotNull(report);
        assertEquals(100L, report.attemptId());
        // Biometric summary is authoritative: exactly 42, 40, 2 (NOT double-counted to 4!)
        assertEquals(42, report.totalFaceChecks());
        assertEquals(40, report.identityMatches());
        assertEquals(2, report.identityMismatches());
        // Discrete violation counters
        assertEquals(1, report.phoneDetectionsCount());
        assertEquals(1, report.lookingAwayCount());
        // Total violations is the count of actual malpractice events (1 phone + 1 gaze + 2 mismatches = 4)
        assertEquals(4, report.totalViolationsCount());
        // SESSION_SUMMARY is not added to event timeline
        assertEquals(4, report.events().size());
        assertEquals("CRITICAL", report.events().get(0).severity());
        assertEquals(0.95, report.events().get(0).confidence());
    }

    @Test
    void testGetAttemptProctoringReport_ZeroFaceChecksWhenNoSummary() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));
        when(proctoringEventRepository.findByAttemptId(100L)).thenReturn(List.of());

        TeacherProctoringReportResponse report = proctoringService.getAttemptProctoringReport(100L, 20L);

        assertNotNull(report);
        assertEquals(0, report.totalFaceChecks()); // No artificial estimation
        assertEquals(0, report.identityMatches());
        assertEquals(0, report.identityMismatches());
        assertEquals(0, report.totalViolationsCount());
        assertEquals(0, report.riskScore());
    }

    @Test
    void testRecordProctoringEvent_ThrowsAccessDeniedForUnauthorizedUser() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        ProctoringEventRequest request = new ProctoringEventRequest("PHONE_DETECTED", "Phone", "CRITICAL", 0.95, null);
        org.junit.jupiter.api.Assertions.assertThrows(
                com.quiz_app.backend.exception.AccessDeniedApplicationException.class,
                () -> proctoringService.recordProctoringEvent(100L, request, 999L) // Wrong user ID
        );
    }

    @Test
    void testRecordProctoringSummary_SavesSummaryEvent() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        ProctoringSummaryRequest request = new ProctoringSummaryRequest(50, 48, 2);
        proctoringService.recordProctoringSummary(100L, request, 10L);

        verify(proctoringEventRepository).save(any(QuizAttemptProctoringEvent.class));
    }

    @Test
    void testVerifyAttemptAccess_Success() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        com.quiz_app.backend.dto.proctoring.ProctoringAccessVerificationResponse response =
                proctoringService.verifyAttemptAccess(100L, 10L);

        assertNotNull(response);
        assertEquals(100L, response.attemptId());
        assertEquals("10", response.studentId());
        assertEquals("john@example.com", response.studentEmail());
        assertEquals("CS101", response.testCode());
        assertEquals("IN_PROGRESS", response.status());
        assertTrue(response.valid());
    }

    @Test
    void testVerifyAttemptAccess_UnauthorizedStudent() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        org.junit.jupiter.api.Assertions.assertThrows(
                com.quiz_app.backend.exception.AccessDeniedApplicationException.class,
                () -> proctoringService.verifyAttemptAccess(100L, 999L)
        );
    }

    @Test
    void testVerifyAttemptAccess_UnauthenticatedUser() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        org.junit.jupiter.api.Assertions.assertThrows(
                com.quiz_app.backend.exception.AccessDeniedApplicationException.class,
                () -> proctoringService.verifyAttemptAccess(100L, null)
        );
    }

    @Test
    void testVerifyAttemptAccess_AttemptNotFound() {
        when(quizAttemptRepository.findById(999L)).thenReturn(Optional.empty());

        org.junit.jupiter.api.Assertions.assertThrows(
                com.quiz_app.backend.exception.ResourceNotFoundException.class,
                () -> proctoringService.verifyAttemptAccess(999L, 10L)
        );
    }

    @Test
    void testVerifyAttemptAccess_AttemptAlreadySubmitted() {
        testAttempt.setStatus(AttemptStatus.SUBMITTED);
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        com.quiz_app.backend.dto.proctoring.ProctoringAccessVerificationResponse response =
                proctoringService.verifyAttemptAccess(100L, 10L);

        assertNotNull(response);
        assertEquals("SUBMITTED", response.status());
        assertFalse(response.valid());
    }
}

