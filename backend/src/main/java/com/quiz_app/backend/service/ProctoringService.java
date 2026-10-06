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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
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
    private final ObjectMapper objectMapper;

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
        this.objectMapper = new ObjectMapper();
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

        String severity = request.severity() != null && !request.severity().isBlank()
                ? request.severity().trim().toUpperCase(Locale.ROOT)
                : (eventType.contains("PHONE") || eventType.contains("IDENTITY") ? "CRITICAL" : "HIGH");
        Double confidence = request.confidence() != null ? request.confidence() : 0.90;

        // Structured JSON metadata
        String metadataJson;
        try {
            Map<String, Object> metaMap = Map.of(
                    "details", request.details() != null ? request.details() : formatEventTitle(eventType),
                    "severity", severity,
                    "confidence", confidence
            );
            metadataJson = objectMapper.writeValueAsString(metaMap);
        } catch (Exception e) {
            metadataJson = request.details();
        }

        // Save event to DB
        QuizAttemptProctoringEvent event = new QuizAttemptProctoringEvent();
        event.setAttempt(attempt);
        event.setEventType(eventType);
        event.setOccurredAt(LocalDateTime.now());
        event.setMetadataJson(metadataJson);
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
            attempt.setStatus(AttemptStatus.AUTO_SUBMITTED);
            attempt.setSubmittedAt(LocalDateTime.now());
            quizAttemptRepository.save(attempt);
            try {
                studentAttemptService.submitAttempt(attemptId, new SubmitAttemptRequest(List.of()), attempt.getStudent().getId());
            } catch (Exception e) {
                logger.warn("Auto-submit through service failed, updating status directly: {}", e.getMessage());
            }
            message = "Assessment auto-submitted due to reaching 3 proctoring violation warnings.";
        }

        return new ProctoringEventResponse(true, currentWarnings, autoSubmitted, message);
    }

    @Transactional
    public void recordProctoringSummary(Long attemptId, ProctoringSummaryRequest request, Long authenticatedUserId) {
        if (attemptId == null || request == null) {
            throw new BadRequestException("INVALID_SUMMARY_REQUEST", "Attempt ID and summary request are required");
        }

        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found"));

        if (authenticatedUserId != null && attempt.getStudent() != null && !attempt.getStudent().getId().equals(authenticatedUserId)) {
            throw new AccessDeniedApplicationException("UNAUTHORIZED_ATTEMPT", "User does not own this attempt");
        }

        try {
            Map<String, Object> metaMap = Map.of(
                    "totalFaceChecks", request.totalFaceChecks(),
                    "identityMatches", request.identityMatches(),
                    "identityMismatches", request.identityMismatches()
            );
            String metadataJson = objectMapper.writeValueAsString(metaMap);

            QuizAttemptProctoringEvent event = new QuizAttemptProctoringEvent();
            event.setAttempt(attempt);
            event.setEventType("SESSION_SUMMARY");
            event.setOccurredAt(LocalDateTime.now());
            event.setMetadataJson(metadataJson);
            proctoringEventRepository.save(event);
            logger.info("Recorded real proctoring summary for attempt {}: checks={}, matches={}, mismatches={}",
                    attemptId, request.totalFaceChecks(), request.identityMatches(), request.identityMismatches());
        } catch (Exception e) {
            logger.error("Failed to serialize proctoring summary for attempt {}: {}", attemptId, e.getMessage());
        }
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
        int multiPersons = 0;
        int lookingAway = 0;
        int phoneDetections = 0;
        int identityMismatches = 0;
        int voiceDetections = 0;
        int tabSwitches = 0;

        int totalFaceChecks = 0;
        int identityMatches = 0;
        boolean hasSummary = false;

        List<TeacherProctoringReportResponse.ProctoringEventDetail> eventDetails = new ArrayList<>();

        for (QuizAttemptProctoringEvent ev : events) {
            String type = ev.getEventType() != null ? ev.getEventType().toUpperCase(Locale.ROOT) : "UNKNOWN";

            if ("SESSION_SUMMARY".equals(type)) {
                try {
                    JsonNode node = objectMapper.readTree(ev.getMetadataJson());
                    if (node.has("totalFaceChecks")) {
                        totalFaceChecks = node.get("totalFaceChecks").asInt(0);
                    }
                    if (node.has("identityMatches")) {
                        identityMatches = node.get("identityMatches").asInt(0);
                    }
                    if (node.has("identityMismatches")) {
                        identityMismatches = Math.max(identityMismatches, node.get("identityMismatches").asInt(0));
                    }
                    hasSummary = true;
                } catch (Exception ignored) {
                }
                continue;
            }

            switch (type) {
                case "FACE_NOT_DETECTED" -> faceAbsence++;
                case "MULTIPLE_FACES" -> multiFaces++;
                case "MULTIPLE_PERSONS" -> multiPersons++;
                case "LOOKING_AWAY" -> lookingAway++;
                case "PHONE_DETECTED" -> phoneDetections++;
                case "IDENTITY_MISMATCH" -> identityMismatches++;
                case "VOICE_ACTIVITY", "LOUD_VOICE" -> voiceDetections++;
                case "TAB_SWITCH", "FULLSCREEN_EXIT" -> tabSwitches++;
            }

            // Extract severity and confidence
            String detailsText = ev.getMetadataJson();
            String severity = type.contains("PHONE") || type.contains("IDENTITY") ? "CRITICAL" : "HIGH";
            Double confidence = 0.90;

            if (ev.getMetadataJson() != null && ev.getMetadataJson().startsWith("{")) {
                try {
                    JsonNode node = objectMapper.readTree(ev.getMetadataJson());
                    if (node.has("details")) {
                        detailsText = node.get("details").asText();
                    }
                    if (node.has("severity")) {
                        severity = node.get("severity").asText();
                    }
                    if (node.has("confidence")) {
                        confidence = node.get("confidence").asDouble();
                    }
                } catch (Exception ignored) {
                }
            }

            eventDetails.add(new TeacherProctoringReportResponse.ProctoringEventDetail(
                    ev.getId(),
                    type,
                    detailsText,
                    severity,
                    confidence,
                    ev.getOccurredAt()
            ));
        }

        // Real identity counts: never fabricate numbers with artificial multipliers
        if (!hasSummary) {
            totalFaceChecks = identityMismatches;
            identityMatches = 0;
        }

        int totalViolations = faceAbsence + multiFaces + multiPersons + lookingAway + phoneDetections + identityMismatches + voiceDetections + tabSwitches;

        // Weighted risk score calculation
        int riskScore = Math.min(100,
                (phoneDetections * 35) +
                (identityMismatches * 30) +
                (multiPersons * 25) +
                (multiFaces * 20) +
                (lookingAway * 15) +
                (faceAbsence * 15) +
                (voiceDetections * 15) +
                (tabSwitches * 10)
        );
        String riskLevel = riskScore >= 65 ? "HIGH" : riskScore >= 30 ? "MEDIUM" : "LOW";

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
                totalViolations,
                riskScore,
                riskLevel,
                totalFaceChecks,
                identityMatches,
                identityMismatches,
                faceAbsence,
                multiFaces,
                multiPersons,
                lookingAway,
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
            case "MULTIPLE_PERSONS" -> "Multiple Persons Detected";
            case "LOOKING_AWAY" -> "Gaze / Looking Away Detected";
            case "IDENTITY_MISMATCH" -> "Biometric Identity Mismatch";
            case "VOICE_ACTIVITY" -> "Voice / Speech Detected";
            case "LOUD_VOICE" -> "Loud Voice Detected";
            case "TAB_SWITCH" -> "Tab Switch / Window Focus Lost";
            case "FULLSCREEN_EXIT" -> "Fullscreen Mode Exited";
            default -> type.replace("_", " ");
        };
    }
}
