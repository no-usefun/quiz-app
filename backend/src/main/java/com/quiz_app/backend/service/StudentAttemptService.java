package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultDetailResponse;
import com.quiz_app.backend.dto.attempt.AttemptResultResponse;
import com.quiz_app.backend.dto.attempt.LeaderboardEntryResponse;
import com.quiz_app.backend.dto.attempt.StudentSubmissionResponse;
import com.quiz_app.backend.dto.attempt.SubmitAnswerRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.dto.exam.OptionResponse;
import com.quiz_app.backend.dto.exam.QuestionResponse;
import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.QuizAvailabilityResponse;
import com.quiz_app.backend.entity.AnswerStatus;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizAvailabilityStatus;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;
import com.quiz_app.backend.entity.StudentAnswer;
import com.quiz_app.backend.entity.StudentSelectedOption;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.AccessDeniedApplicationException;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.StudentAnswerRepository;
import com.quiz_app.backend.repository.StudentSelectedOptionRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.transaction.Transactional;

@Service
public class StudentAttemptService {

        private final QuizAttemptRepository quizAttemptRepository;
        private final QuizRepository quizRepository;
        private final UserRepository userRepository;
        private final StudentAnswerRepository studentAnswerRepository;
        private final StudentSelectedOptionRepository studentSelectedOptionRepository;
        private final QuestionRepository questionRepository;
        private final OptionRepository optionRepository;
        private final QuizAllowedStudentRepository quizAllowedStudentRepository;
        private final Clock clock;

        private static final ZoneId QUIZ_TIMEZONE = ZoneId.of("Asia/Kolkata");

        public StudentAttemptService(
                        QuizAttemptRepository quizAttemptRepository, QuizRepository quizRepository,
                        UserRepository userRepository,
                        StudentAnswerRepository studentAnswerRepository,
                        StudentSelectedOptionRepository studentSelectedOptionRepository,
                        QuestionRepository questionRepository,
                        OptionRepository optionRepository,
                        QuizAllowedStudentRepository quizAllowedStudentRepository,
                        Clock clock) {
                this.quizAttemptRepository = quizAttemptRepository;
                this.quizRepository = quizRepository;
                this.userRepository = userRepository;
                this.studentAnswerRepository = studentAnswerRepository;
                this.studentSelectedOptionRepository = studentSelectedOptionRepository;
                this.questionRepository = questionRepository;
                this.optionRepository = optionRepository;
                this.quizAllowedStudentRepository = quizAllowedStudentRepository;
                this.clock = clock;
        }

        @Transactional
        public AttemptResponse startAttempt(
                        String quizCode,
                        Long studentId) {

                if (quizCode == null || quizCode.isBlank()) {
                        throw new BadRequestException("QUIZ_CODE_REQUIRED",
                                        "Quiz code is required");
                }

                quizCode = quizCode.trim().toUpperCase();

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                User student = userRepository.findById(studentId)
                                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

                // 1. Verify student role
                if (student.getRole() == null
                                || !"STUDENT".equals(student.getRole().getName())) {

                        throw new BadRequestException(
                                        "INVALID_STUDENT_ROLE",
                                        "Only a student can start a quiz");
                }

                // 2. Find quiz
                Quiz quiz = quizRepository.findByQuizCode(quizCode)
                                .orElseThrow(() -> {
                                        throw new ResourceNotFoundException("QUIZ_NOT_FOUND",
                                                        "Quiz not found");
                                });

                // 3. Quiz must be published
                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "QUIZ_NOT_AVAILABLE",
                                        "Quiz is not available");
                }

                LocalDateTime now = LocalDateTime.now(clock.withZone(QUIZ_TIMEZONE));

                // 4. Check exam window

                if (quiz.getStartTime() != null
                                && now.isBefore(quiz.getStartTime())) {

                        throw new BadRequestException(
                                        "QUIZ_NOT_STARTED",
                                        "Quiz has not started yet");
                }

                if (quiz.getEndTime() != null
                                && !now.isBefore(quiz.getEndTime())) {
                        throw new BadRequestException(
                                        "QUIZ_ENDED",
                                        "Quiz has already ended");
                }

                // 5. Check accepted email domain
                String acceptedDomain = quiz.getAcceptedEmailDomain();

                if (acceptedDomain != null && !acceptedDomain.isBlank()) {

                        String studentEmail = student.getEmail();

                        if (studentEmail == null
                                        || !studentEmail.toLowerCase()
                                                        .endsWith(acceptedDomain.toLowerCase())) {

                                throw new BadRequestException(
                                                "STUDENT_NOT_ELIGIBLE",
                                                "Student is not eligible for this quiz");
                        }
                }

                // 6. Check registration whitelist
                String registrationNo = student.getRegistrationNo();

                if (registrationNo != null
                                && quizAllowedStudentRepository
                                                .existsByQuizIdAndRegistrationNumberIgnoreCase(
                                                                quiz.getId(),
                                                                registrationNo)) {

                        // Student explicitly allowed.
                } else {

                        boolean whitelistConfigured = quizAllowedStudentRepository
                                        .existsByQuizId(quiz.getId());

                        if (whitelistConfigured) {
                                throw new BadRequestException(
                                                "STUDENT_REGISTRATION_NOT_ALLOWED",
                                                "Student registration number is not allowed for this quiz");
                        }
                }

                // 7. Check for an existing attempt
                Optional<QuizAttempt> existingAttempt = quizAttemptRepository.findByQuizQuizCodeAndStudentId(
                                quizCode,
                                student.getId());

                if (existingAttempt.isPresent()) {

                        QuizAttempt attempt = existingAttempt.get();

                        // An active attempt can be resumed.
                        if (attempt.getStatus() == AttemptStatus.IN_PROGRESS) {
                                LocalDateTime effectiveDeadline = attempt.getStartedAt()
                                                .plusSeconds(quiz.getOverallTimerSeconds());

                                if (quiz.getEndTime() != null
                                                && quiz.getEndTime().isBefore(effectiveDeadline)) {
                                        effectiveDeadline = quiz.getEndTime();
                                }

                                return new AttemptResponse(
                                                attempt.getId(),
                                                quiz.getId(),
                                                student.getId(),
                                                attempt.getStartedAt(),
                                                attempt.getSubmittedAt(),
                                                attempt.getStatus(),
                                                attempt.getCurrentQuestion(),
                                                attempt.getTotalTimeTaken(),
                                                effectiveDeadline);
                        }

                        // A completed attempt cannot be started again.
                        throw new ConflictException(
                                        "ATTEMPT_ALREADY_SUBMITTED");
                }

                // 8. Create attempt
                QuizAttempt attempt = new QuizAttempt();

                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStartedAt(now);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);

                attempt.setCurrentQuestion(1);
                attempt.setTotalTimeTaken(0);

                // Phase 2 fields
                attempt.setWarningsCount(0);
                attempt.setRefreshCount(0);
                attempt.setReconnectCount(0);

                attempt.setFinalScore(java.math.BigDecimal.ZERO);
                attempt.setCreatedAt(now);

                attempt = quizAttemptRepository.save(attempt);

                LocalDateTime effectiveDeadline = attempt.getStartedAt()
                                .plusSeconds(quiz.getOverallTimerSeconds());

                if (quiz.getEndTime() != null
                                && quiz.getEndTime().isBefore(effectiveDeadline)) {
                        effectiveDeadline = quiz.getEndTime();
                }

                // 9. Return safe response
                return new AttemptResponse(
                                attempt.getId(),
                                quiz.getId(),
                                student.getId(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt(),
                                attempt.getStatus(),
                                attempt.getCurrentQuestion(),
                                attempt.getTotalTimeTaken(),
                                effectiveDeadline);
        }

        private void validateSelectionCount(
                        Question question,
                        List<Option> selectedOptions) {

                int count = selectedOptions.size();

                switch (question.getQuestionType()) {

                        case MCQ, TRUE_FALSE -> {

                                if (count > 1) {
                                        throw new BadRequestException(
                                                        "MULTIPLE_OPTIONS_NOT_ALLOWED",
                                                        "Only one option can be selected");
                                }
                        }

                        case MSQ -> {
                                // Multiple selections are allowed.
                        }
                }
        }

        @Transactional
        public SubmitAttemptResponse autoSubmitAttempt(
                        Long attemptId, Long studentId) {

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                User student = userRepository.findById(studentId)
                                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

                // 1. Verify student role
                if (student.getRole() == null
                                || !"STUDENT".equals(student.getRole().getName())) {

                        throw new BadRequestException(
                                        "INVALID_STUDENT_ROLE",
                                        "Only a student can start a quiz");
                }

                if (attemptId == null) {
                        throw new BadRequestException("ATTEMPT_ID_REQUIRED",
                                        "Attempt ID is required");
                }

                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> {
                                        throw new AccessDeniedApplicationException(
                                                        "ATTEMPT_NOT_OWNED",
                                                        "You are not authorized to access this attempt");
                                });

                if (attempt.getStudent() == null || !attempt.getStudent().getId().equals(studentId)) {

                        throw new AccessDeniedApplicationException(
                                        "ATTEMPT_NOT_OWNED",
                                        "You are not authorized to access this attempt");
                }

                return finalizeAttempt(
                                attempt,
                                AttemptStatus.AUTO_SUBMITTED);
        }

        @Transactional
        public SubmitAttemptResponse submitAttempt(
                        Long attemptId,
                        SubmitAttemptRequest request,
                        Long studentId) {

                if (attemptId == null) {
                        throw new BadRequestException("ATTEMPT_ID_REQUIRED",
                                        "Attempt ID is required");
                }

                if (request == null) {
                        throw new BadRequestException(
                                        "SUBMISSION_REQUEST_REQUIRED",
                                        "Submission request is required");
                }

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> {
                                        throw new AccessDeniedApplicationException(
                                                        "ATTEMPT_NOT_OWNED",
                                                        "You are not authorized to access this attempt");
                                });

                if (attempt.getStudent() == null
                                || !attempt.getStudent().getId().equals(studentId)) {

                        throw new AccessDeniedApplicationException(
                                        "ATTEMPT_NOT_OWNED",
                                        "You are not authorized to submit this attempt");
                }

                if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
                        throw new ConflictException(
                                        "ATTEMPT_ALREADY_SUBMITTED",
                                        "Attempt has already been submitted");
                }

                Quiz quiz = attempt.getQuiz();

                LocalDateTime now = LocalDateTime.now(clock.withZone(QUIZ_TIMEZONE));

                /*
                 * Backend is the source of truth for the deadline.
                 */
                boolean deadlineExceeded = isAttemptDeadlineExceeded(attempt, quiz, now);

                List<SubmitAnswerRequest> submittedAnswers = request.answers();

                if (submittedAnswers == null) {
                        submittedAnswers = List.of();
                }

                Set<Long> submittedQuestionIds = submittedAnswers.stream()
                                .map(SubmitAnswerRequest::questionId)
                                .filter(java.util.Objects::nonNull)
                                .collect(Collectors.toSet());

                if (submittedQuestionIds.size() != submittedAnswers.size()) {
                        throw new BadRequestException(
                                        "INVALID_SUBMISSION",
                                        "Submission contains duplicate or invalid question IDs");
                }

                /*
                 * Save the complete answer sheet before scoring.
                 */
                saveSubmittedAnswers(
                                attempt,
                                submittedAnswers);

                /*
                 * If the server deadline has already passed,
                 * this submission is treated as an auto-submission.
                 */
                AttemptStatus finalStatus = deadlineExceeded
                                ? AttemptStatus.AUTO_SUBMITTED
                                : AttemptStatus.SUBMITTED;

                return finalizeAttempt(
                                attempt,
                                finalStatus);
        }

        private void saveSubmittedAnswers(
                        QuizAttempt attempt,
                        List<SubmitAnswerRequest> submittedAnswers) {

                Quiz quiz = attempt.getQuiz();

                List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(
                                quiz.getId());

                Map<Long, Question> questionMap = questions.stream()
                                .collect(Collectors.toMap(
                                                Question::getId,
                                                Function.identity()));

                for (SubmitAnswerRequest submittedAnswer : submittedAnswers) {

                        if (submittedAnswer.questionId() == null) {
                                throw new BadRequestException(
                                                "QUESTION_ID_REQUIRED",
                                                "Question ID is required");
                        }

                        Question question = questionMap.get(submittedAnswer.questionId());

                        if (question == null) {
                                throw new BadRequestException(
                                                "QUESTION_NOT_IN_QUIZ",
                                                "Question does not belong to this quiz: "
                                                                + submittedAnswer.questionId());
                        }

                        List<Long> selectedIds = submittedAnswer.selectedOptionIds();

                        if (selectedIds == null) {
                                selectedIds = List.of();
                        }

                        if (submittedAnswer.responseTimeSeconds() != null
                                        && submittedAnswer.responseTimeSeconds() < 0) {

                                throw new BadRequestException(
                                                "INVALID_RESPONSE_TIME",
                                                "Response time cannot be negative");
                        }

                        /*
                         * Load and validate selected options.
                         */
                        List<Option> selectedOptions = selectedIds.stream()
                                        .map(optionId -> optionRepository.findById(optionId)
                                                        .orElseThrow(() -> new ResourceNotFoundException(
                                                                        "Option not found: "
                                                                                        + optionId)))
                                        .toList();

                        /*
                         * Make sure every option belongs to this question.
                         */
                        for (Option option : selectedOptions) {

                                if (option.getQuestion() == null
                                                || !option.getQuestion().getId()
                                                                .equals(question.getId())) {

                                        throw new BadRequestException(
                                                        "INVALID_SUBMISSION",
                                                        "Selected option does not belong to this question");
                                }
                        }

                        /*
                         * Validate MCQ / MSQ / TRUE_FALSE selection rules.
                         */
                        validateSelectionCount(
                                        question,
                                        selectedOptions);

                        /*
                         * Find existing answer or create one.
                         */
                        StudentAnswer answer = studentAnswerRepository
                                        .findByAttemptIdAndQuestionId(
                                                        attempt.getId(),
                                                        question.getId())
                                        .orElseGet(StudentAnswer::new);

                        answer.setAttempt(attempt);
                        answer.setQuestion(question);

                        answer.setAnswerStatus(
                                        selectedOptions.isEmpty()
                                                        ? AnswerStatus.UNANSWERED
                                                        : AnswerStatus.ANSWERED);

                        /*
                         * Scoring happens later in finalizeAttempt().
                         */
                        answer.setCorrect(false);
                        answer.setMarksAwarded(BigDecimal.ZERO);

                        answer.setResponseTimeSeconds(
                                        submittedAnswer.responseTimeSeconds());

                        answer.setAnsweredAt(
                                        selectedOptions.isEmpty()
                                                        ? null
                                                        : LocalDateTime.now());

                        answer = studentAnswerRepository.save(answer);

                        /*
                         * Replace any previous selections.
                         */
                        studentSelectedOptionRepository.deleteByAnswerId(
                                        answer.getId());

                        for (Option option : selectedOptions) {

                                StudentSelectedOption selectedOption = new StudentSelectedOption();

                                selectedOption.setAnswer(answer);
                                selectedOption.setOption(option);
                                selectedOption.setCreatedAt(
                                                LocalDateTime.now());

                                studentSelectedOptionRepository.save(
                                                selectedOption);
                        }
                }
        }

        @Transactional
        private SubmitAttemptResponse finalizeAttempt(
                        QuizAttempt attempt,
                        AttemptStatus finalStatus) {

                if (attempt == null) {
                        throw new BadRequestException("ATTEMPT_REQUIRED",
                                        "Attempt is required");
                }

                if (finalStatus != AttemptStatus.SUBMITTED
                                && finalStatus != AttemptStatus.AUTO_SUBMITTED) {
                        throw new BadRequestException(
                                        "INVALID_FINAL_ATTEMPT_STATUS",
                                        "Invalid final attempt status");
                }

                if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
                        throw new ConflictException(
                                        "ATTEMPT_ALREADY_SUBMITTED",
                                        "Attempt has already been submitted");
                }

                Quiz quiz = attempt.getQuiz();

                if (quiz == null) {
                        throw new ResourceNotFoundException(
                                        "QUIZ_NOT_FOUND",
                                        "Quiz associated with attempt was not found");
                }

                LocalDateTime submittedAt = LocalDateTime.now(clock.withZone(QUIZ_TIMEZONE));

                /*
                 * Load all questions belonging to this quiz.
                 */
                List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(
                                quiz.getId());

                if (questions == null || questions.isEmpty()) {
                        throw new BadRequestException(
                                        "QUIZ_HAS_NO_QUESTIONS",
                                        "Quiz does not contain any questions");
                }

                /*
                 * Load existing answers for this attempt.
                 */
                List<StudentAnswer> existingAnswers = studentAnswerRepository.findByAttemptId(attempt.getId());

                Map<Long, StudentAnswer> answerMap = existingAnswers.stream()
                                .collect(Collectors.toMap(
                                                answer -> answer.getQuestion().getId(),
                                                Function.identity(),
                                                (existing, duplicate) -> existing));

                BigDecimal finalScore = BigDecimal.ZERO;

                /*
                 * Every question must have an answer record.
                 * If the student never answered a question,
                 * create an explicit UNANSWERED record.
                 */
                for (Question question : questions) {

                        StudentAnswer answer = answerMap.get(question.getId());

                        if (answer == null) {
                                answer = new StudentAnswer();

                                answer.setAttempt(attempt);
                                answer.setQuestion(question);
                                answer.setAnswerStatus(AnswerStatus.UNANSWERED);
                                answer.setCorrect(false);
                                answer.setMarksAwarded(BigDecimal.ZERO);
                                answer.setResponseTimeSeconds(0);
                                answer.setAnsweredAt(null);

                                answer = studentAnswerRepository.save(answer);

                                answerMap.put(question.getId(), answer);
                        }

                        /*
                         * Get selected options.
                         */
                        List<StudentSelectedOption> selectedAnswerOptions = studentSelectedOptionRepository
                                        .findByAnswerId(answer.getId());

                        Set<Long> selectedOptionIds = selectedAnswerOptions.stream()
                                        .map(selected -> selected.getOption().getId())
                                        .collect(Collectors.toSet());

                        /*
                         * Get the correct options.
                         */
                        List<Option> correctOptions = optionRepository.findByQuestionIdAndCorrectTrue(
                                        question.getId());

                        Set<Long> correctOptionIds = correctOptions.stream()
                                        .map(Option::getId)
                                        .collect(Collectors.toSet());

                        /*
                         * Compare the sets.
                         *
                         * This handles:
                         * - MCQ
                         * - MSQ
                         * - TRUE/FALSE
                         *
                         * The answer is correct only when the selected
                         * options exactly match the correct options.
                         */
                        boolean isCorrect = !selectedOptionIds.isEmpty()
                                        && selectedOptionIds.equals(correctOptionIds);

                        BigDecimal marksAwarded = BigDecimal.ZERO;

                        if (isCorrect) {

                                marksAwarded = question.getMarks();

                        } else if (!selectedOptionIds.isEmpty()
                                        && quiz.isNegativeMarking()) {

                                BigDecimal negativeMarks = question.getNegativeMarks();

                                if (negativeMarks != null
                                                && negativeMarks.compareTo(BigDecimal.ZERO) > 0) {

                                        marksAwarded = negativeMarks.negate();
                                }
                        }

                        answer.setCorrect(isCorrect);
                        answer.setMarksAwarded(marksAwarded);

                        /*
                         * If the student selected something, it is ANSWERED.
                         * Otherwise it remains UNANSWERED.
                         */
                        if (selectedOptionIds.isEmpty()) {
                                answer.setAnswerStatus(AnswerStatus.UNANSWERED);
                        } else {
                                answer.setAnswerStatus(AnswerStatus.ANSWERED);
                        }

                        studentAnswerRepository.save(answer);

                        finalScore = finalScore.add(marksAwarded);
                }

                /*
                 * Calculate actual time spent.
                 *
                 * The server calculates this; never trust the frontend timer.
                 */
                int totalTimeTaken = calculateTimeTaken(
                                attempt,
                                quiz,
                                submittedAt);

                /*
                 * Finalize attempt.
                 */
                attempt.setFinalScore(finalScore);
                attempt.setTotalTimeTaken(totalTimeTaken);
                attempt.setSubmittedAt(submittedAt);
                attempt.setStatus(finalStatus);

                quizAttemptRepository.save(attempt);

                /*
                 * Return the normal submission response.
                 */
                return new SubmitAttemptResponse(
                                attempt.getId(),
                                quiz.getId(),
                                attempt.getStatus(),
                                attempt.getFinalScore(),
                                quiz.getTotalMarks(),
                                attempt.getTotalTimeTaken(),
                                attempt.getSubmittedAt());
        }

        private int calculateTimeTaken(
                        QuizAttempt attempt,
                        Quiz quiz,
                        LocalDateTime submittedAt) {

                long elapsedSeconds = Duration.between(
                                attempt.getStartedAt(),
                                submittedAt).getSeconds();

                long allowedSeconds = quiz.getOverallTimerSeconds();

                long timeTaken = Math.min(
                                elapsedSeconds,
                                allowedSeconds);

                /*
                 * The quiz endTime is an additional hard deadline.
                 */
                if (quiz.getEndTime() != null
                                && attempt.getStartedAt().isBefore(quiz.getEndTime())) {

                        long windowSeconds = Duration.between(
                                        attempt.getStartedAt(),
                                        quiz.getEndTime()).getSeconds();

                        timeTaken = Math.min(
                                        timeTaken,
                                        windowSeconds);
                }

                return (int) Math.max(0, timeTaken);
        }

        public AttemptResultResponse getAttemptResult(
                        Long attemptId,
                        Long studentId) {

                if (attemptId == null) {
                        throw new BadRequestException("ATTEMPT_ID_REQUIRED",
                                        "Attempt ID is required");
                }

                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> {
                                        throw new AccessDeniedApplicationException(
                                                        "ATTEMPT_NOT_OWNED",
                                                        "You are not authorized to view this result");
                                });

                if (attempt.getStudent() == null ||
                                !attempt.getStudent().getId().equals(studentId)) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_OWNED",
                                        "You are not authorized to view this result");
                }

                Quiz quiz = attempt.getQuiz();

                if (attempt.getStatus() != AttemptStatus.SUBMITTED
                                && attempt.getStatus() != AttemptStatus.AUTO_SUBMITTED) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_SUBMITTED",
                                        "Result is available only after submission");
                }

                if (!quiz.isResultsPublished()) {
                        throw new BadRequestException(
                                        "RESULTS_NOT_PUBLISHED",
                                        "Results have not been published yet");
                }

                BigDecimal totalMarks = quiz.getTotalMarks();

                BigDecimal percentage = BigDecimal.ZERO;

                if (totalMarks != null && totalMarks.compareTo(BigDecimal.ZERO) > 0) {
                        percentage = attempt.getFinalScore()
                                        .multiply(BigDecimal.valueOf(100))
                                        .divide(totalMarks, 2, java.math.RoundingMode.HALF_UP);
                }

                return new AttemptResultResponse(
                                attempt.getId(),
                                quiz.getId(),
                                quiz.getTitle(),
                                attempt.getStudent().getId(),
                                attempt.getStatus(),
                                attempt.getFinalScore(),
                                totalMarks,
                                percentage,
                                attempt.getTotalTimeTaken(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt());
        }

        public List<AttemptResultDetailResponse> getAttemptResultDetails(
                        Long attemptId,
                        Long studentId) {

                if (attemptId == null) {
                        throw new BadRequestException("ATTEMPT_ID_REQUIRED",
                                        "Attempt ID is required");
                }

                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> {
                                        throw new AccessDeniedApplicationException(
                                                        "ATTEMPT_NOT_OWNED",
                                                        "You are not authorized to view this result");
                                });

                if (attempt.getStudent() == null ||
                                !attempt.getStudent().getId().equals(studentId)) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_OWNED",
                                        "You are not authorized to view this result");
                }

                Quiz quiz = attempt.getQuiz();

                if (attempt.getStatus() != AttemptStatus.SUBMITTED
                                && attempt.getStatus() != AttemptStatus.AUTO_SUBMITTED) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_SUBMITTED",
                                        "Result is available only after submission");
                }

                if (!quiz.isResultsPublished()) {
                        throw new BadRequestException("RESULTS_NOT_PUBLISHED",
                                        "Results have not been published yet");
                }

                if (quiz.getResultVisibility() != ResultVisibility.QUESTION_WISE
                                && quiz.getResultVisibility() != ResultVisibility.BOTH) {

                        throw new BadRequestException(
                                        "RESULT_DETAILS_NOT_AVAILABLE",
                                        "Question-wise results are not available");
                }

                List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(
                                attempt.getQuiz().getId());

                List<StudentAnswer> answers = studentAnswerRepository.findByAttemptId(attemptId);

                java.util.Map<Long, StudentAnswer> answerMap = new java.util.HashMap<>();

                for (StudentAnswer answer : answers) {
                        answerMap.put(
                                        answer.getQuestion().getId(),
                                        answer);
                }

                List<AttemptResultDetailResponse> result = new java.util.ArrayList<>();

                for (Question question : questions) {

                        StudentAnswer answer = answerMap.get(question.getId());

                        List<Long> selectedOptionIds = new java.util.ArrayList<>();

                        List<Long> correctOptionIds = optionRepository
                                        .findByQuestionIdOrderByOptionOrder(question.getId())
                                        .stream()
                                        .filter(Option::isCorrect)
                                        .map(Option::getId)
                                        .toList();

                        AnswerStatus answerStatus;
                        boolean correct = false;
                        BigDecimal marksAwarded = BigDecimal.ZERO;
                        Integer responseTimeSeconds = null;

                        if (answer == null) {

                                answerStatus = AnswerStatus.UNANSWERED;

                        } else {

                                answerStatus = answer.getAnswerStatus();
                                correct = answer.isCorrect();
                                marksAwarded = answer.getMarksAwarded();
                                responseTimeSeconds = answer.getResponseTimeSeconds();

                                List<StudentSelectedOption> selectedOptions = studentSelectedOptionRepository
                                                .findByAnswerId(answer.getId());

                                selectedOptionIds = selectedOptions.stream()
                                                .map(selected -> selected.getOption().getId())
                                                .toList();
                        }

                        result.add(
                                        new AttemptResultDetailResponse(
                                                        question.getId(),
                                                        question.getQuestionText(),
                                                        question.getDisplayOrder(),
                                                        selectedOptionIds,
                                                        correctOptionIds,
                                                        answerStatus,
                                                        correct,
                                                        marksAwarded,
                                                        question.getMarks(),
                                                        responseTimeSeconds));
                }

                return result;
        }

        public List<LeaderboardEntryResponse> getLeaderboard(Long quizId, Long studentId) {

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                User student = userRepository.findById(studentId)
                                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

                // 1. Verify student role
                if (student.getRole() == null
                                || !"STUDENT".equals(student.getRole().getName())) {

                        throw new BadRequestException(
                                        "INVALID_STUDENT_ROLE",
                                        "Only a student can start a quiz");
                }

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> {
                                        throw new ResourceNotFoundException(
                                                        "QUIZ_NOT_FOUND",
                                                        "Quiz not found");
                                });

                if (!quiz.isResultsPublished()) {
                        throw new BadRequestException(
                                        "RESULTS_NOT_PUBLISHED",
                                        "Results have not been published yet");
                }

                if (quiz.getResultVisibility() != ResultVisibility.LEADERBOARD
                                && quiz.getResultVisibility() != ResultVisibility.BOTH) {

                        throw new BadRequestException(
                                        "LEADERBOARD_NOT_AVAILABLE",
                                        "Leaderboard is not available");
                }

                List<QuizAttempt> attempts = quizAttemptRepository.findByQuizId(quizId);

                List<QuizAttempt> submittedAttempts = attempts.stream()
                                .filter(attempt -> attempt.getStatus() == AttemptStatus.SUBMITTED
                                                || attempt.getStatus() == AttemptStatus.AUTO_SUBMITTED)
                                .sorted(
                                                java.util.Comparator
                                                                .comparing(
                                                                                QuizAttempt::getFinalScore,
                                                                                java.util.Comparator.reverseOrder())
                                                                .thenComparing(
                                                                                QuizAttempt::getTotalTimeTaken))
                                .toList();

                List<LeaderboardEntryResponse> result = new java.util.ArrayList<>();

                int rank = 1;

                for (QuizAttempt attempt : submittedAttempts) {

                        BigDecimal score = attempt.getFinalScore();

                        BigDecimal percentage = BigDecimal.ZERO;

                        if (quiz.getTotalMarks() != null
                                        && quiz.getTotalMarks()
                                                        .compareTo(BigDecimal.ZERO) > 0) {

                                percentage = score
                                                .multiply(BigDecimal.valueOf(100))
                                                .divide(
                                                                quiz.getTotalMarks(),
                                                                2,
                                                                java.math.RoundingMode.HALF_UP);
                        }

                        result.add(
                                        new LeaderboardEntryResponse(
                                                        rank++,
                                                        attempt.getStudent().getId(),
                                                        attempt.getStudent().getFullName(),
                                                        score,
                                                        quiz.getTotalMarks(),
                                                        percentage,
                                                        attempt.getTotalTimeTaken()));
                }

                return result;
        }

        private boolean isAttemptDeadlineExceeded(
                        QuizAttempt attempt,
                        Quiz quiz,
                        LocalDateTime now) {

                LocalDateTime deadline = attempt.getStartedAt()
                                .plusSeconds(quiz.getOverallTimerSeconds());

                if (quiz.getEndTime() != null
                                && quiz.getEndTime().isBefore(deadline)) {
                        deadline = quiz.getEndTime();
                }

                return !now.isBefore(deadline);
        }

        public List<StudentSubmissionResponse> getStudentSubmissions(
                        Long studentId) {

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                List<QuizAttempt> attempts = quizAttemptRepository
                                .findByStudentIdAndStatusInOrderBySubmittedAtDesc(
                                                studentId,
                                                List.of(
                                                                AttemptStatus.SUBMITTED,
                                                                AttemptStatus.AUTO_SUBMITTED));

                return attempts.stream()
                                .map(this::toStudentSubmissionResponse)
                                .toList();
        }

        private StudentSubmissionResponse toStudentSubmissionResponse(
                        QuizAttempt attempt) {

                Quiz quiz = attempt.getQuiz();

                boolean resultsAvailable = quiz.isResultsPublished();

                BigDecimal finalScore = null;
                BigDecimal totalMarks = null;
                BigDecimal percentage = null;

                if (resultsAvailable) {
                        finalScore = attempt.getFinalScore();
                        totalMarks = quiz.getTotalMarks();

                        if (totalMarks != null && totalMarks.compareTo(BigDecimal.ZERO) > 0) {
                                percentage = finalScore
                                                .multiply(BigDecimal.valueOf(100))
                                                .divide(totalMarks, 2, RoundingMode.HALF_UP);
                        }
                }

                return new StudentSubmissionResponse(
                                attempt.getId(),
                                quiz.getId(),
                                quiz.getTitle(),
                                attempt.getStatus(),
                                finalScore,
                                totalMarks,
                                percentage,
                                attempt.getTotalTimeTaken(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt(),
                                resultsAvailable);
        }

        public QuizAvailabilityResponse getQuizAvailability(String quizCode, Long studentId) {

                String normalizedCode = quizCode == null
                                ? null
                                : quizCode.trim().toUpperCase();

                Optional<Quiz> quizOptional = quizRepository.findByQuizCode(normalizedCode);

                if (studentId == null) {
                        throw new BadRequestException(
                                        "STUDENT_AUTHENTICATION_REQUIRED",
                                        "Student authentication is required");
                }

                if (quizOptional.isEmpty()) {
                        return new QuizAvailabilityResponse(
                                        normalizedCode,
                                        false,
                                        QuizAvailabilityStatus.NOT_FOUND,
                                        null,
                                        null);
                }

                Quiz quiz = quizOptional.get();

                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        return buildAvailabilityResponse(
                                        quiz,
                                        QuizAvailabilityStatus.NOT_PUBLISHED,
                                        false);
                }

                LocalDateTime now = LocalDateTime.now(clock.withZone(QUIZ_TIMEZONE));

                if (now.isBefore(quiz.getStartTime())) {
                        return buildAvailabilityResponse(
                                        quiz,
                                        QuizAvailabilityStatus.NOT_STARTED,
                                        false);
                }

                if (!now.isBefore(quiz.getEndTime())) {
                        return buildAvailabilityResponse(
                                        quiz,
                                        QuizAvailabilityStatus.ENDED,
                                        false);
                }

                return buildAvailabilityResponse(
                                quiz,
                                QuizAvailabilityStatus.LIVE,
                                true);
        }

        private QuizAvailabilityResponse buildAvailabilityResponse(
                        Quiz quiz,
                        QuizAvailabilityStatus status,
                        boolean available) {

                return new QuizAvailabilityResponse(
                                quiz.getQuizCode(),
                                available,
                                status,
                                quiz.getStartTime(),
                                quiz.getEndTime());
        }

        public QuizPackageResponse getQuizPackage(Long quizId) {

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "Quiz is not available to students");
                }

                var questions = new ArrayList<>(
                                questionRepository.findByQuizIdOrderByDisplayOrder(quizId));

                if (quiz.isRandomQuestionOrder()) {
                        Collections.shuffle(questions);
                }

                var questionResponses = questions.stream()
                                .map(question -> {

                                        var options = new ArrayList<>(
                                                        optionRepository
                                                                        .findByQuestionIdOrderByOptionOrder(
                                                                                        question.getId()));

                                        if (quiz.isRandomOptionOrder()) {
                                                Collections.shuffle(options);
                                        }

                                        var optionResponses = options.stream()
                                                        .map(option -> new OptionResponse(
                                                                        option.getId(),
                                                                        option.getOptionText(),
                                                                        option.getOptionImage(),
                                                                        option.getOptionOrder()))
                                                        .toList();

                                        return new QuestionResponse(
                                                        question.getId(),
                                                        question.getQuestionText(),
                                                        question.getImageUrl(),
                                                        question.getQuestionType(),
                                                        question.getMarks(),
                                                        question.getNegativeMarks(),
                                                        question.getQuestionTimerSeconds(),
                                                        question.getDifficulty(),
                                                        question.getDisplayOrder(),
                                                        optionResponses);
                                })
                                .toList();

                return new QuizPackageResponse(
                                quiz.getId(),
                                quiz.getTitle(),
                                quiz.getDescription(),
                                quiz.getInstructions(),
                                quiz.getSubject(),
                                quiz.getSubjectCode(),
                                quiz.getTotalStudents(),
                                quiz.getTotalQuestions(),
                                quiz.getTotalMarks(),
                                quiz.getOverallTimerSeconds(),
                                quiz.isNegativeMarking(),
                                quiz.getNegativeMarks(),
                                quiz.isRandomQuestionOrder(),
                                quiz.isRandomOptionOrder(),
                                quiz.isAllowReview(),
                                quiz.isAllowResume(),
                                quiz.isAutoSubmit(),
                                quiz.getStartTime(),
                                quiz.getEndTime(),
                                questionResponses);
        }

        public QuizPackageResponse getQuizPackageByCode(String quizCode) {

                Quiz quiz = quizRepository.findByQuizCode(quizCode)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                return getQuizPackage(quiz.getId());
        }
}