package com.quiz_app.backend.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.ActivityLogRepository;
import com.quiz_app.backend.repository.DeviceRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;

@Service
public class ProctoringService {

    private final QuizAttemptRepository quizAttemptRepository;
    private final ActivityLogRepository activityLogRepository;
    private final DeviceRepository deviceRepository;
    private final QuestionRepository questionRepository;
    private final QuizRepository quizRepository;

    private static final List<ActivityType> ALL_VIOLATIONS = Arrays.asList(
            ActivityType.TAB_SWITCH,
            ActivityType.WINDOW_BLUR,
            ActivityType.FULLSCREEN_EXIT,
            ActivityType.RIGHT_CLICK,
            ActivityType.COPY_ATTEMPT,
            ActivityType.FACE_NOT_DETECTED,
            ActivityType.MULTIPLE_FACES,
            ActivityType.LOOKING_AWAY,
            ActivityType.VOICE_DETECTED,
            ActivityType.SUSPICIOUS_OBJECT,
            ActivityType.DEVICE_SWITCH
    );

    private static final List<ActivityType> FACE_VIOLATIONS = Arrays.asList(
            ActivityType.FACE_NOT_DETECTED,
            ActivityType.MULTIPLE_FACES,
            ActivityType.LOOKING_AWAY
    );

    public ProctoringService(
            QuizAttemptRepository quizAttemptRepository,
            ActivityLogRepository activityLogRepository,
            DeviceRepository deviceRepository,
            QuestionRepository questionRepository,
            QuizRepository quizRepository) {
        this.quizAttemptRepository = quizAttemptRepository;
        this.activityLogRepository = activityLogRepository;
        this.deviceRepository = deviceRepository;
        this.questionRepository = questionRepository;
        this.quizRepository = quizRepository;
    }

    @Transactional
    public LogActivityResponse recordActivity(Long attemptId, LogActivityRequest request) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found with ID: " + attemptId));

        Question question = null;
        if (request.questionId() != null) {
            question = questionRepository.findById(request.questionId()).orElse(null);
        }

        LocalDateTime eventTime = request.activityTime() != null ? request.activityTime() : LocalDateTime.now();

        // 1. Create and persist ActivityLog
        ActivityLog log = new ActivityLog();
        log.setAttempt(attempt);
        log.setQuestion(question);
        log.setActivityType(request.activityType());
        log.setActivityTime(eventTime);
        log.setDetails(request.details());
        activityLogRepository.save(log);

        Quiz quiz = attempt.getQuiz();
        int maxAllowedWarnings = (quiz != null && quiz.getMaxTabSwitch() != null) ? quiz.getMaxTabSwitch() : 3;

        boolean warningExceeded = false;
        boolean autoSubmitted = false;
        String message = "Activity recorded successfully";

        // 2. Handle violation counting & thresholds if attempt is still IN_PROGRESS
        if (request.activityType().isViolation() && attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
            int currentWarnings = (attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0) + 1;
            attempt.setWarningsCount(currentWarnings);

            if (currentWarnings >= maxAllowedWarnings) {
                warningExceeded = true;
                message = "Maximum warning threshold reached (" + currentWarnings + "/" + maxAllowedWarnings + ")";

                if (quiz != null && quiz.isAutoSubmit()) {
                    attempt.setStatus(AttemptStatus.AUTO_SUBMITTED);
                    attempt.setSubmittedAt(eventTime);
                    autoSubmitted = true;
                    message = "Exam auto-submitted due to excessive integrity violations (" + currentWarnings + "/" + maxAllowedWarnings + ")";

                    // Log auto-submit action
                    ActivityLog autoSubmitLog = new ActivityLog();
                    autoSubmitLog.setAttempt(attempt);
                    autoSubmitLog.setQuestion(question);
                    autoSubmitLog.setActivityType(ActivityType.AUTO_SUBMIT);
                    autoSubmitLog.setActivityTime(eventTime);
                    autoSubmitLog.setDetails("Auto-submitted: exceeded warning limit of " + maxAllowedWarnings);
                    activityLogRepository.save(autoSubmitLog);
                }
            }

            quizAttemptRepository.save(attempt);
        }

        int finalWarningCount = attempt.getWarningsCount() != null ? attempt.getWarningsCount() : 0;
        return new LogActivityResponse(
                true,
                finalWarningCount,
                maxAllowedWarnings,
                warningExceeded,
                autoSubmitted,
                message
        );
    }

    @Transactional
    public LogActivityResponse recordBatchActivities(Long attemptId, BatchLogActivityRequest request) {
        LogActivityResponse lastResponse = null;
        for (LogActivityRequest event : request.events()) {
            lastResponse = recordActivity(attemptId, event);
            if (lastResponse.autoSubmitted()) {
                break; // Stop processing further events if exam has auto-submitted
            }
        }
        return lastResponse != null ? lastResponse : new LogActivityResponse(true, 0, 3, false, false, "Batch processed");
    }

    @Transactional
    public void registerDevice(Long attemptId, RegisterDeviceRequest request) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found with ID: " + attemptId));

        Device device = new Device();
        device.setAttempt(attempt);
        device.setIpAddress(request.ipAddress());
        device.setBrowserName(request.browserName());
        device.setBrowserVersion(request.browserVersion());
        device.setOperatingSystem(request.operatingSystem());
        device.setDeviceType(request.deviceType());
        device.setScreenWidth(request.screenWidth());
        device.setScreenHeight(request.screenHeight());
        device.setUserAgent(request.userAgent());
        device.setLoginTime(LocalDateTime.now());
        deviceRepository.save(device);

        // Record initial device telemetry log
        ActivityLog log = new ActivityLog();
        log.setAttempt(attempt);
        log.setActivityType(ActivityType.LOGIN);
        log.setActivityTime(LocalDateTime.now());
        log.setDetails("Device registered: " + (request.deviceType() != null ? request.deviceType().name() : "UNKNOWN") + " | " + request.browserName() + " on " + request.operatingSystem());
        activityLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<ActivityLogResponse> getAttemptLogs(Long attemptId) {
        if (!quizAttemptRepository.existsById(attemptId)) {
            throw new ResourceNotFoundException("Quiz attempt not found with ID: " + attemptId);
        }

        return activityLogRepository.findByAttemptIdOrderByActivityTimeAsc(attemptId)
                .stream()
                .map(ActivityLogResponse::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProctoringSummaryResponse getAttemptSummary(Long attemptId) {
        QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz attempt not found with ID: " + attemptId));

        User student = attempt.getStudent();
        String studentName = student != null ? student.getFullName() : "Unknown Candidate";
        String studentEmail = student != null ? student.getEmail() : "";
        Long studentId = student != null ? student.getId() : null;

        int tabSwitches = (int) activityLogRepository.countByAttemptIdAndActivityType(attemptId, ActivityType.TAB_SWITCH);
        int fullscreenExits = (int) activityLogRepository.countByAttemptIdAndActivityType(attemptId, ActivityType.FULLSCREEN_EXIT);
        int faceWarnings = (int) activityLogRepository.countByAttemptIdAndActivityTypeIn(attemptId, FACE_VIOLATIONS);
        int voiceWarnings = (int) activityLogRepository.countByAttemptIdAndActivityType(attemptId, ActivityType.VOICE_DETECTED);
        int totalViolations = (int) activityLogRepository.countByAttemptIdAndActivityTypeIn(attemptId, ALL_VIOLATIONS);

        List<ActivityLogResponse> recentViolations = activityLogRepository
                .findByAttemptIdAndActivityTypeInOrderByActivityTimeDesc(attemptId, ALL_VIOLATIONS)
                .stream()
                .limit(10)
                .map(ActivityLogResponse::fromEntity)
                .toList();

        boolean isIntegrityFlagged = totalViolations > 0 || (attempt.getWarningsCount() != null && attempt.getWarningsCount() > 0);

        return new ProctoringSummaryResponse(
                attempt.getId(),
                studentId,
                studentName,
                studentEmail,
                attempt.getStatus(),
                totalViolations,
                tabSwitches,
                fullscreenExits,
                faceWarnings,
                voiceWarnings,
                isIntegrityFlagged,
                recentViolations
        );
    }

    @Transactional(readOnly = true)
    public QuizProctoringOverviewResponse getQuizProctoringOverview(Long quizId) {
        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found with ID: " + quizId));

        List<QuizAttempt> attempts = quizAttemptRepository.findByQuizId(quizId);

        List<ProctoringSummaryResponse> candidateSummaries = new ArrayList<>();
        int inProgressCount = 0;
        int flaggedCount = 0;
        int totalViolationsCount = 0;

        for (QuizAttempt attempt : attempts) {
            ProctoringSummaryResponse summary = getAttemptSummary(attempt.getId());
            candidateSummaries.add(summary);

            if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
                inProgressCount++;
            }
            if (summary.isIntegrityFlagged()) {
                flaggedCount++;
            }
            totalViolationsCount += summary.totalViolations();
        }

        return new QuizProctoringOverviewResponse(
                quiz.getId(),
                quiz.getTitle(),
                quiz.getQuizCode(),
                attempts.size(),
                inProgressCount,
                flaggedCount,
                totalViolationsCount,
                candidateSummaries
        );
    }
}
