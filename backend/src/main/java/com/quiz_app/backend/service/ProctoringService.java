package com.quiz_app.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.proctoring.ProctoringEventRequest;
import com.quiz_app.backend.dto.proctoring.ProctoringEventResponse;
import com.quiz_app.backend.dto.proctoring.TeacherProctoringReportResponse;
import com.quiz_app.backend.dto.proctoring.TeacherQuizProctoringOverviewResponse;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizAttemptProctoringEvent;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.AccessDeniedApplicationException;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.QuizAttemptProctoringEventRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;

@Service
public class ProctoringService {

    private static final Logger logger = LoggerFactory.getLogger(ProctoringService.class);
    private static final int MAX_WARNINGS = 3;
    private static final long DEBOUNCE_INTERVAL_MS = 4000L;

    private final QuizAttemptRepository quizAttemptRepository;
    private final QuizAttemptProctoringEventRepository proctoringEventRepository;
    private final QuizRepository quizRepository;
    private final StudentAttemptService studentAttemptService;

    // Debounce cache per (attemptId:eventType)
    private final Map<String, Long> debounceCache = new ConcurrentHashMap<>();

    public ProctoringService(
            QuizAttemptRepository quizAttemptRepository,
            QuizAttemptProctoringEventRepository proctoringEventRepository,
            QuizRepository quizRepository,
            StudentAttemptService studentAttemptService) {
        this.quizAttemptRepository = quizAttemptRepository;
        this.proctoringEventRepository = proctoringEventRepository;
        this.quizRepository = quizRepository;
        this.studentAttemptService = studentAttemptService;
    }

    @Transactional
    public ProctoringEventResponse recordProctoringEvent(Long attemptId, ProctoringEventRequest request, Long authenticatedUserId) {
        if (attemptId == null || request == null || request.eventType() == null) {
            throw new BadRequestException("INVALID_EVENT_REQUEST", "Attempt ID and event type are required");
        }

        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found"));

        if (authenticatedUserId != null && attempt.getStudent() != null && !attempt.getStudent().getId().equals(authenticatedUserId)) {
            throw new AccessDeniedApplicationException("UNAUTHORIZED_ATTEMPT", "User does not own this attempt");
        }

        if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
            return new ProctoringEventResponse(
                    false,
                    attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0,
                    attempt.getStatus() == AttemptStatus.AUTO_SUBMITTED,
                    "Attempt is already closed: " + attempt.getStatus()
            );
        }

        String eventType = request.eventType().trim().toUpperCase(Locale.ROOT);
        String debounceKey = attemptId + ":" + eventType;
        long now = System.currentTimeMillis();

        Long lastRecorded = debounceCache.get(debounceKey);
        if (lastRecorded != null && (now - lastRecorded) < DEBOUNCE_INTERVAL_MS) {
            return new ProctoringEventResponse(
                    false,
                    attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0,
                    false,
                    "Debounced duplicate event"
            );
        }
        debounceCache.put(debounceKey, now);

        // Save event to DB
        QuizAttemptProctoringEvent event = new QuizAttemptProctoringEvent();
        event.setAttempt(attempt);
        event.setEventType(eventType);
        event.setOccurredAt(LocalDateTime.now());
        event.setMetadataJson(request.details());
        proctoringEventRepository.save(event);

        // Increment warning count
        int currentWarnings = (attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0) + 1;
        attempt.setWarningsCount(currentWarnings);
        quizAttemptRepository.save(attempt);

        boolean autoSubmitted = false;
        String message = String.format("Warning %d of %d: %s", currentWarnings, MAX_WARNINGS, formatEventTitle(eventType));

        if (currentWarnings >= MAX_WARNINGS) {
            autoSubmitted = true;
            attempt.setTerminationReason("MALPRACTICE_WARNING_LIMIT");
            quizAttemptRepository.save(attempt);
            try {
                studentAttemptService.submitAttempt(attemptId, new SubmitAttemptRequest(List.of()), attempt.getStudent().getId());
            } catch (Exception e) {
                logger.warn("Auto-submit through service failed, updating status directly: {}", e.getMessage());
                attempt.setStatus(AttemptStatus.AUTO_SUBMITTED);
                attempt.setSubmittedAt(LocalDateTime.now());
                quizAttemptRepository.save(attempt);
            }
            message = "Assessment auto-submitted due to reaching 3 proctoring violation warnings.";
        }

        return new ProctoringEventResponse(true, currentWarnings, autoSubmitted, message);
    }

    @Transactional(readOnly = true)
    public TeacherProctoringReportResponse getAttemptProctoringReport(Long attemptId, Long teacherId) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found"));

        Quiz quiz = attempt.getQuiz();
        if (teacherId != null && quiz.getTeacher() != null && !quiz.getTeacher().getId().equals(teacherId)) {
            throw new AccessDeniedApplicationException("UNAUTHORIZED_TEACHER", "Not authorized to view this quiz report");
        }

        List<QuizAttemptProctoringEvent> events = proctoringEventRepository.findByAttemptId(attemptId);
        return buildReportResponse(attempt, events);
    }

    @Transactional(readOnly = true)
    public TeacherQuizProctoringOverviewResponse getQuizProctoringOverview(String quizCode, Long teacherId) {
        Quiz quiz = quizRepository.findByQuizCode(quizCode)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

        if (teacherId != null && quiz.getTeacher() != null && !quiz.getTeacher().getId().equals(teacherId)) {
            throw new AccessDeniedApplicationException("UNAUTHORIZED_TEACHER", "Not authorized to view this quiz overview");
        }

        List<QuizAttempt> attempts = quizAttemptRepository.findByQuizId(quiz.getId());
        List<TeacherProctoringReportResponse> reports = new ArrayList<>();

        int flagged = 0;
        int autoSubmitted = 0;
        double totalRisk = 0;

        for (QuizAttempt att : attempts) {
            List<QuizAttemptProctoringEvent> events = proctoringEventRepository.findByAttemptId(att.getId());
            TeacherProctoringReportResponse rep = buildReportResponse(att, events);
            reports.add(rep);

            if (rep.warningCount() > 0 || rep.riskScore() >= 30) {
                flagged++;
            }
            if (att.getStatus() == AttemptStatus.AUTO_SUBMITTED) {
                autoSubmitted++;
            }
            totalRisk += rep.riskScore();
        }

        double avgRisk = attempts.isEmpty() ? 0.0 : Math.round((totalRisk / attempts.size()) * 10.0) / 10.0;

        return new TeacherQuizProctoringOverviewResponse(
                quiz.getQuizCode(),
                quiz.getTitle(),
                attempts.size(),
                flagged,
                autoSubmitted,
                avgRisk,
                reports
        );
    }

    private TeacherProctoringReportResponse buildReportResponse(QuizAttempt attempt, List<QuizAttemptProctoringEvent> events) {
        int faceAbsence = 0;
        int multiFaces = 0;
        int phoneDetections = 0;
        int identityMismatches = 0;
        int voiceDetections = 0;
        int tabSwitches = 0;

        List<TeacherProctoringReportResponse.ProctoringEventDetail> eventDetails = new ArrayList<>();

        for (QuizAttemptProctoringEvent ev : events) {
            String type = ev.getEventType() != null ? ev.getEventType().toUpperCase(Locale.ROOT) : "UNKNOWN";
            switch (type) {
                case "FACE_NOT_DETECTED", "LOOKING_AWAY" -> faceAbsence++;
                case "MULTIPLE_FACES", "MULTIPLE_PERSONS" -> multiFaces++;
                case "PHONE_DETECTED" -> phoneDetections++;
                case "IDENTITY_MISMATCH" -> identityMismatches++;
                case "VOICE_ACTIVITY", "LOUD_VOICE" -> voiceDetections++;
                case "TAB_SWITCH", "FULLSCREEN_EXIT" -> tabSwitches++;
            }

            eventDetails.add(new TeacherProctoringReportResponse.ProctoringEventDetail(
                    ev.getId(),
                    type,
                    ev.getMetadataJson(),
                    type.contains("PHONE") || type.contains("IDENTITY") ? "CRITICAL" : "HIGH",
                    ev.getOccurredAt()
            ));
        }

        // Weighted risk score calculation
        int riskScore = Math.min(100, (phoneDetections * 35) + (identityMismatches * 30) + (multiFaces * 25) + (faceAbsence * 15) + (voiceDetections * 15) + (tabSwitches * 10));
        String riskLevel = riskScore >= 65 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

        int totalFaceChecks = Math.max(1, events.size() * 5);
        int identityMatches = Math.max(0, totalFaceChecks - identityMismatches);

        User student = attempt.getStudent();
        Quiz quiz = attempt.getQuiz();

        return new TeacherProctoringReportResponse(
                attempt.getId(),
                student != null ? student.getId() : null,
                student != null ? student.getFullName() : "Unknown Student",
                student != null ? student.getEmail() : "N/A",
                quiz != null ? quiz.getQuizCode() : "N/A",
                quiz != null ? quiz.getTitle() : "N/A",
                attempt.getStatus() != null ? attempt.getStatus().name() : "IN_PROGRESS",
                attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0,
                riskScore,
                riskLevel,
                totalFaceChecks,
                identityMatches,
                identityMismatches,
                faceAbsence,
                multiFaces,
                phoneDetections,
                voiceDetections,
                tabSwitches,
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                eventDetails
        );
    }

    private String formatEventTitle(String type) {
        return switch (type) {
            case "PHONE_DETECTED" -> "Mobile Phone Detected";
            case "FACE_NOT_DETECTED" -> "Face Not Detected";
            case "MULTIPLE_FACES" -> "Multiple Faces Detected";
            case "IDENTITY_MISMATCH" -> "Biometric Identity Mismatch";
            case "VOICE_ACTIVITY" -> "Voice / Speech Detected";
            case "LOUD_VOICE" -> "Loud Voice Detected";
            case "TAB_SWITCH" -> "Tab Switch / Window Focus Lost";
            case "FULLSCREEN_EXIT" -> "Fullscreen Mode Exited";
            default -> type.replace("_", " ");
        };
    }
}
