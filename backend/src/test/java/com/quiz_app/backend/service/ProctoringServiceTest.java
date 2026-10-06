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
    void testRecordProctoringEvent_IncrementsWarning() {
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
    }

    @Test
    void testGetAttemptProctoringReport_CalculatesTrueMetrics() {
        when(quizAttemptRepository.findById(100L)).thenReturn(Optional.of(testAttempt));

        QuizAttemptProctoringEvent ev1 = new QuizAttemptProctoringEvent();
        setField(ev1, "id", 1L);
        ev1.setEventType("PHONE_DETECTED");
        ev1.setMetadataJson("Phone in frame");
        ev1.setOccurredAt(LocalDateTime.now());

        QuizAttemptProctoringEvent ev2 = new QuizAttemptProctoringEvent();
        setField(ev2, "id", 2L);
        ev2.setEventType("FACE_NOT_DETECTED");
        ev2.setMetadataJson("No face in frame");
        ev2.setOccurredAt(LocalDateTime.now());

        when(proctoringEventRepository.findByAttemptId(100L)).thenReturn(List.of(ev1, ev2));

        TeacherProctoringReportResponse report = proctoringService.getAttemptProctoringReport(100L, 20L);

        assertNotNull(report);
        assertEquals(100L, report.attemptId());
        assertEquals(1, report.phoneDetectionsCount());
        assertEquals(1, report.faceAbsenceCount());
        assertEquals(0, report.identityMismatches());
        assertTrue(report.riskScore() >= 50); // 35 (phone) + 15 (face absence) = 50
    }

    @Test
    void testGetQuizProctoringOverview() {
        when(quizRepository.findByQuizCode("CS101")).thenReturn(Optional.of(testQuiz));
        when(quizAttemptRepository.findByQuizId(1L)).thenReturn(List.of(testAttempt));
        when(proctoringEventRepository.findByAttemptId(100L)).thenReturn(List.of());

        TeacherQuizProctoringOverviewResponse overview = proctoringService.getQuizProctoringOverview("CS101", 20L);

        assertNotNull(overview);
        assertEquals("CS101", overview.quizCode());
        assertEquals(1, overview.totalAttempts());
    }
}
