package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.attempt.LeaderboardEntryResponse;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.dto.quiz.TeacherQuizDetailResponse;
import com.quiz_app.backend.dto.quiz.UpdateQuizSettingsRequest;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAllowedStudent;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;

@Service
@Transactional
public class TeacherQuizService {

        private final QuizRepository quizRepository;
        private final QuestionRepository questionRepository;
        private final OptionRepository optionRepository;
        private final QuizAllowedStudentRepository quizAllowedStudentRepository;
        private final QuizAttemptRepository quizAttemptRepository;

        public TeacherQuizService(QuizRepository quizRepository, QuestionRepository questionRepository,
                        OptionRepository optionRepository, QuizAllowedStudentRepository quizAllowedStudentRepository,
                        QuizAttemptRepository quizAttemptRepository) {
                this.quizRepository = quizRepository;
                this.questionRepository = questionRepository;
                this.optionRepository = optionRepository;
                this.quizAllowedStudentRepository = quizAllowedStudentRepository;
                this.quizAttemptRepository = quizAttemptRepository;
        }

        @Transactional
        public void publishResults(Long quizId, Long teacherId) {

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null ||
                                !quiz.getTeacher().getId().equals(teacherId)) {

                        throw new BadRequestException(
                                        "You are not authorized to publish results for this quiz");
                }

                if (quiz.getStatus() != QuizStatus.COMPLETED) {
                        throw new BadRequestException(
                                        "Results can only be published after the quiz is completed");
                }

                quiz.setResultsPublished(true);

                quizRepository.save(quiz);
        }

        @Transactional
        public void unpublishResults(Long quizId, Long teacherId) {

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null ||
                                !quiz.getTeacher().getId().equals(teacherId)) {

                        throw new BadRequestException(
                                        "You are not authorized to publish results for this quiz");
                }

                if (quiz.getStatus() != QuizStatus.COMPLETED) {
                        throw new BadRequestException(
                                        "Results can only be published after the quiz is completed");
                }

                quiz.setResultsPublished(false);

                quizRepository.save(quiz);
        }

        @Transactional
        public void publishQuiz(Long quizId, Long teacherId) {

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                if (teacherId == null) {
                        throw new BadRequestException("Teacher authentication is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                // Ownership check
                if (quiz.getTeacher() == null ||
                                !quiz.getTeacher().getId().equals(teacherId)) {

                        throw new BadRequestException(
                                        "You are not authorized to publish this quiz");
                }

                // Only drafts can be published
                if (quiz.getStatus() != QuizStatus.DRAFT) {
                        throw new BadRequestException(
                                        "Only a draft quiz can be published");
                }

                // Load questions
                var questions = questionRepository
                                .findByQuizIdOrderByDisplayOrder(quizId);

                if (questions == null || questions.isEmpty()) {
                        throw new BadRequestException(
                                        "Quiz must contain at least one question");
                }

                BigDecimal totalMarks = BigDecimal.ZERO;

                for (Question question : questions) {

                        validateQuestionForPublish(question);

                        var options = optionRepository
                                        .findByQuestionIdOrderByOptionOrder(
                                                        question.getId());

                        validateOptionsForPublish(question, options);

                        totalMarks = totalMarks.add(
                                        question.getMarks() != null
                                                        ? question.getMarks()
                                                        : BigDecimal.ZERO);
                }

                // Validate quiz-level configuration
                if (quiz.getOverallTimerSeconds() == null ||
                                quiz.getOverallTimerSeconds() <= 0) {

                        throw new BadRequestException(
                                        "Overall quiz timer must be greater than zero");
                }

                if (quiz.getStartTime() == null) {
                        throw new BadRequestException(
                                        "Quiz start time is required before publishing");
                }

                if (quiz.getEndTime() == null) {
                        throw new BadRequestException(
                                        "Quiz end time is required before publishing");
                }

                if (!quiz.getEndTime().isAfter(quiz.getStartTime())) {
                        throw new BadRequestException(
                                        "Quiz end time must be after start time");
                }

                if (quiz.isNegativeMarking()) {

                        if (quiz.getNegativeMarks() == null ||
                                        quiz.getNegativeMarks()
                                                        .compareTo(BigDecimal.ZERO) < 0) {

                                throw new BadRequestException(
                                                "Invalid negative marking configuration");
                        }
                }

                if (totalMarks.compareTo(BigDecimal.ZERO) <= 0) {
                        throw new BadRequestException(
                                        "Quiz total marks must be greater than zero");
                }

                // Recalculate instead of trusting stale values
                quiz.setTotalQuestions(questions.size());
                quiz.setTotalMarks(totalMarks);

                // Publish quiz
                quiz.setStatus(QuizStatus.PUBLISHED);

                // It has not started yet
                quiz.setExamState(ExamState.WAITING);

                quiz.setUpdatedAt(LocalDateTime.now());

                quizRepository.save(quiz);
        }

        private void validateQuestionForPublish(Question question) {

                if (question.getQuestionType() == null) {
                        throw new BadRequestException(
                                        "Question type is required");
                }

                if ((question.getQuestionText() == null ||
                                question.getQuestionText().isBlank())
                                &&
                                (question.getImageUrl() == null ||
                                                question.getImageUrl().isBlank())) {

                        throw new BadRequestException(
                                        "Every question must contain text or an image");
                }

                if (question.getMarks() == null ||
                                question.getMarks().compareTo(BigDecimal.ZERO) <= 0) {

                        throw new BadRequestException(
                                        "Every question must have marks greater than zero");
                }

                if (question.getNegativeMarks() != null &&
                                question.getNegativeMarks()
                                                .compareTo(BigDecimal.ZERO) < 0) {

                        throw new BadRequestException(
                                        "Question negative marks cannot be negative");
                }

                if (question.getDisplayOrder() == null ||
                                question.getDisplayOrder() <= 0) {

                        throw new BadRequestException(
                                        "Question display order must be greater than zero");
                }
        }

        private void validateOptionsForPublish(
                        Question question,
                        java.util.List<Option> options) {

                if (options == null || options.isEmpty()) {
                        throw new BadRequestException(
                                        "Every question must contain options");
                }

                long correctOptions = options.stream()
                                .filter(Option::isCorrect)
                                .count();

                switch (question.getQuestionType()) {

                        case MCQ -> {
                                if (correctOptions != 1) {
                                        throw new BadRequestException(
                                                        "MCQ must have exactly one correct option");
                                }
                        }

                        case MSQ -> {
                                if (correctOptions < 1) {
                                        throw new BadRequestException(
                                                        "MSQ must have at least one correct option");
                                }
                        }

                        case TRUE_FALSE -> {

                                if (options.size() != 2) {
                                        throw new BadRequestException(
                                                        "TRUE_FALSE must have exactly two options");
                                }

                                if (correctOptions != 1) {
                                        throw new BadRequestException(
                                                        "TRUE_FALSE must have exactly one correct option");
                                }
                        }
                }

                java.util.Set<Integer> orders = new java.util.HashSet<>();

                for (Option option : options) {

                        if ((option.getOptionText() == null ||
                                        option.getOptionText().isBlank())
                                        &&
                                        (option.getOptionImage() == null ||
                                                        option.getOptionImage().isBlank())) {

                                throw new BadRequestException(
                                                "Every option must contain text or an image");
                        }

                        if (option.getOptionOrder() == null ||
                                        option.getOptionOrder() <= 0) {

                                throw new BadRequestException(
                                                "Option order must be greater than zero");
                        }

                        if (!orders.add((int) option.getOptionOrder())) {
                                throw new BadRequestException(
                                                "Duplicate option order found in question "
                                                                + question.getId());
                        }
                }
        }

        private QuizResponse toQuizResponse(Quiz quiz) {
                return new QuizResponse(
                                quiz.getId(),
                                quiz.getQuizCode(),
                                quiz.getTeacher() != null ? quiz.getTeacher().getId() : null,
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
                                quiz.isTimeBonusEnabled(),
                                quiz.isRandomQuestionOrder(),
                                quiz.isRandomOptionOrder(),
                                quiz.isAllowReview(),
                                quiz.isAllowResume(),
                                quiz.isAutoSubmit(),
                                quiz.getStartTime(),
                                quiz.getEndTime(),
                                quiz.getResultVisibility(),
                                quiz.isResultsPublished(),
                                quiz.getAcceptedEmailDomain(),
                                quizAllowedStudentRepository.findByQuizId(quiz.getId())
                                                .stream()
                                                .map(QuizAllowedStudent::getRegistrationNumber)
                                                .toList(),
                                quiz.getStatus(),
                                quiz.getExamState());
        }

        @Transactional(readOnly = true)
        public List<QuizResponse> getTeacherQuizzes(Long teacherId) {

                if (teacherId == null) {
                        throw new BadRequestException("Teacher authentication is required");
                }

                List<Quiz> quizzes = quizRepository.findByTeacherIdOrderByCreatedAtDesc(teacherId);

                return quizzes.stream()
                                .map(this::toQuizResponse)
                                .toList();
        }

        @Transactional
        public QuizResponse updateQuizSettings(
                        Long quizId,
                        Long teacherId,
                        UpdateQuizSettingsRequest request) {

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                if (teacherId == null) {
                        throw new BadRequestException("Teacher authentication is required");
                }

                if (request == null) {
                        throw new BadRequestException("Settings request is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null ||
                                !quiz.getTeacher().getId().equals(teacherId)) {

                        throw new BadRequestException(
                                        "You are not authorized to update this quiz");
                }

                if (quiz.getStatus() != QuizStatus.DRAFT) {
                        throw new BadRequestException(
                                        "Quiz settings can only be updated while the quiz is in DRAFT status");
                }

                if (request.overallTimerSeconds() != null) {
                        if (request.overallTimerSeconds() <= 0) {
                                throw new BadRequestException(
                                                "Overall timer must be greater than zero");
                        }

                        quiz.setOverallTimerSeconds(request.overallTimerSeconds());
                }

                if (request.negativeMarking() != null) {
                        quiz.setNegativeMarking(request.negativeMarking());
                }

                if (request.negativeMarks() != null) {
                        if (request.negativeMarks().compareTo(BigDecimal.ZERO) < 0) {
                                throw new BadRequestException(
                                                "Negative marks cannot be negative");
                        }

                        quiz.setNegativeMarks(request.negativeMarks());
                }

                if (request.timeBonusEnabled() != null) {
                        quiz.setTimeBonusEnabled(request.timeBonusEnabled());
                }

                if (request.randomQuestionOrder() != null) {
                        quiz.setRandomQuestionOrder(request.randomQuestionOrder());
                }

                if (request.randomOptionOrder() != null) {
                        quiz.setRandomOptionOrder(request.randomOptionOrder());
                }

                if (request.allowReview() != null) {
                        quiz.setAllowReview(request.allowReview());
                }

                if (request.allowResume() != null) {
                        quiz.setAllowResume(request.allowResume());
                }

                if (request.autoSubmit() != null) {
                        quiz.setAutoSubmit(request.autoSubmit());
                }

                if (request.maxTabSwitch() != null) {
                        if (request.maxTabSwitch() < 0) {
                                throw new BadRequestException(
                                                "Maximum tab switches cannot be negative");
                        }

                        quiz.setMaxTabSwitch(request.maxTabSwitch());
                }

                if (request.startTime() != null) {
                        quiz.setStartTime(request.startTime());
                }

                if (request.endTime() != null) {
                        quiz.setEndTime(request.endTime());
                }

                if (quiz.getStartTime() != null &&
                                quiz.getEndTime() != null &&
                                !quiz.getEndTime().isAfter(quiz.getStartTime())) {

                        throw new BadRequestException(
                                        "End time must be after start time");
                }

                if (request.resultVisibility() != null) {
                        quiz.setResultVisibility(request.resultVisibility());
                }

                if (request.questions() != null) {
                        updateQuestionsAndOptions(quiz, request.questions());
                }

                if (request.acceptedEmailDomain() != null) {

                        String domain = request.acceptedEmailDomain().trim().toLowerCase();

                        if (!domain.isBlank() && !domain.startsWith("@")) {
                                throw new BadRequestException(
                                                "Accepted email domain must start with @");
                        }

                        quiz.setAcceptedEmailDomain(
                                        domain.isBlank() ? null : domain);
                }

                if (request.allowedRegistrationNumbers() != null) {

                        quizAllowedStudentRepository.deleteByQuizId(quizId);

                        Set<String> registrations = request.allowedRegistrationNumbers()
                                        .stream()
                                        .filter(Objects::nonNull)
                                        .map(String::trim)
                                        .filter(value -> !value.isBlank())
                                        .collect(Collectors.toCollection(LinkedHashSet::new));

                        for (String registrationNumber : registrations) {

                                QuizAllowedStudent allowedStudent = new QuizAllowedStudent();

                                allowedStudent.setQuiz(quiz);
                                allowedStudent.setRegistrationNumber(registrationNumber);

                                quizAllowedStudentRepository.save(allowedStudent);
                        }
                }

                quiz.setUpdatedAt(LocalDateTime.now());

                Quiz savedQuiz = quizRepository.save(quiz);

                return toQuizResponse(savedQuiz);
        }

        private void updateQuestionsAndOptions(
                        Quiz quiz,
                        List<UpdateQuizSettingsRequest.QuestionSettingsRequest> requests) {

                Long quizId = quiz.getId();

                List<Question> existingQuestions = questionRepository.findByQuizIdOrderByDisplayOrder(quizId);

                validateQuestionRequests(requests);

                /*
                 * First move existing display orders temporarily.
                 * This prevents unique constraint violations when, for example,
                 * question 1 and question 2 swap positions.
                 */
                int maxDisplayOrder = existingQuestions.stream()
                                .map(Question::getDisplayOrder)
                                .filter(Objects::nonNull)
                                .max(Integer::compareTo)
                                .orElse(0);

                int temporaryOrder = maxDisplayOrder + existingQuestions.size() + 1000;

                for (Question question : existingQuestions) {
                        question.setDisplayOrder(temporaryOrder--);
                }

                questionRepository.saveAllAndFlush(existingQuestions);

                Map<Long, Question> existingQuestionMap = existingQuestions.stream()
                                .collect(Collectors.toMap(
                                                Question::getId,
                                                Function.identity()));

                Set<Long> retainedQuestionIds = new HashSet<>();

                List<Question> questionsToSave = new ArrayList<>();

                for (UpdateQuizSettingsRequest.QuestionSettingsRequest request : requests) {

                        Question question;

                        if (request.questionId() == null) {

                                question = new Question();

                                question.setQuiz(quiz);
                                question.setCreatedAt(LocalDateTime.now());

                        } else {

                                question = existingQuestionMap.get(request.questionId());

                                if (question == null) {
                                        throw new BadRequestException(
                                                        "Question does not belong to this quiz: "
                                                                        + request.questionId());
                                }

                                retainedQuestionIds.add(question.getId());
                        }

                        question.setQuestionText(request.questionText());
                        question.setImageUrl(request.imageUrl());
                        question.setExplanation(request.explanation());
                        question.setQuestionType(request.questionType());
                        question.setMarks(request.marks());
                        question.setNegativeMarks(
                                        request.negativeMarks() != null
                                                        ? request.negativeMarks()
                                                        : BigDecimal.ZERO);
                        question.setQuestionTimerSeconds(
                                        request.questionTimerSeconds());
                        question.setDifficulty(request.difficulty());
                        question.setDisplayOrder(request.displayOrder());
                        question.setUpdatedAt(LocalDateTime.now());

                        validateQuestionForPublish(question);

                        questionsToSave.add(question);
                }

                /*
                 * Delete questions removed from the request.
                 */
                for (Question existing : existingQuestions) {

                        if (!retainedQuestionIds.contains(existing.getId())) {

                                List<Option> options = optionRepository.findByQuestionIdOrderByOptionOrder(
                                                existing.getId());

                                optionRepository.deleteAll(options);
                                questionRepository.delete(existing);
                        }
                }

                List<Question> savedQuestions = questionRepository.saveAll(questionsToSave);

                /*
                 * Update options after questions have their IDs.
                 */
                for (int i = 0; i < requests.size(); i++) {

                        UpdateQuizSettingsRequest.QuestionSettingsRequest request = requests.get(i);

                        Question question = savedQuestions.get(i);

                        if (request.options() == null) {
                                throw new BadRequestException(
                                                "Options are required for every question");
                        }

                        updateOptions(question, request.options());
                }

                /*
                 * Recalculate quiz totals.
                 */
                List<Question> finalQuestions = questionRepository.findByQuizIdOrderByDisplayOrder(quizId);

                BigDecimal totalMarks = finalQuestions.stream()
                                .map(Question::getMarks)
                                .filter(java.util.Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);

                quiz.setTotalQuestions(finalQuestions.size());
                quiz.setTotalMarks(totalMarks);
        }

        private void validateQuestionRequests(
                        List<UpdateQuizSettingsRequest.QuestionSettingsRequest> requests) {

                Set<Integer> displayOrders = new HashSet<>();
                Set<Long> questionIds = new HashSet<>();

                for (var request : requests) {

                        if (request.questionType() == null) {
                                throw new BadRequestException(
                                                "Question type is required");
                        }

                        if (request.displayOrder() == null
                                        || request.displayOrder() <= 0) {

                                throw new BadRequestException(
                                                "Question display order must be greater than zero");
                        }

                        if (!displayOrders.add(request.displayOrder())) {
                                throw new BadRequestException(
                                                "Duplicate question display order: "
                                                                + request.displayOrder());
                        }

                        if (request.questionId() != null
                                        && !questionIds.add(request.questionId())) {

                                throw new BadRequestException(
                                                "Duplicate question ID: "
                                                                + request.questionId());
                        }

                        if (request.marks() == null
                                        || request.marks().compareTo(BigDecimal.ZERO) <= 0) {

                                throw new BadRequestException(
                                                "Question marks must be greater than zero");
                        }

                        if (request.negativeMarks() != null
                                        && request.negativeMarks()
                                                        .compareTo(BigDecimal.ZERO) < 0) {

                                throw new BadRequestException(
                                                "Question negative marks cannot be negative");
                        }
                }
        }

        private void validateOptionRequests(
                        List<UpdateQuizSettingsRequest.OptionSettingsRequest> requests) {

                if (requests.isEmpty()) {
                        throw new BadRequestException(
                                        "Every question must contain options");
                }

                Set<Short> optionOrders = new HashSet<>();
                Set<Long> optionIds = new HashSet<>();

                for (var request : requests) {

                        if (request.optionOrder() == null
                                        || request.optionOrder() <= 0) {

                                throw new BadRequestException(
                                                "Option order must be greater than zero");
                        }

                        if (!optionOrders.add(request.optionOrder())) {
                                throw new BadRequestException(
                                                "Duplicate option order found");
                        }

                        if (request.optionId() != null
                                        && !optionIds.add(request.optionId())) {

                                throw new BadRequestException(
                                                "Duplicate option ID: "
                                                                + request.optionId());
                        }

                        if ((request.optionText() == null
                                        || request.optionText().isBlank())
                                        && (request.optionImage() == null
                                                        || request.optionImage().isBlank())) {

                                throw new BadRequestException(
                                                "Every option must contain text or an image");
                        }
                }
        }

        private void updateOptions(
                        Question question,
                        List<UpdateQuizSettingsRequest.OptionSettingsRequest> requests) {

                List<Option> existingOptions = optionRepository.findByQuestionIdOrderByOptionOrder(
                                question.getId());

                validateOptionRequests(requests);

                /*
                 * Temporarily move existing orders to avoid
                 * unique(question_id, option_order) conflicts.
                 */
                short maxOptionOrder = existingOptions.stream()
                                .map(Option::getOptionOrder)
                                .filter(Objects::nonNull)
                                .max(Short::compareTo)
                                .orElse((short) 0);

                short temporaryOrder = (short) (maxOptionOrder + existingOptions.size() + 100);

                for (Option option : existingOptions) {
                        option.setOptionOrder(temporaryOrder--);
                }

                optionRepository.saveAllAndFlush(existingOptions);

                Map<Long, Option> existingOptionMap = existingOptions.stream()
                                .collect(Collectors.toMap(
                                                Option::getId,
                                                Function.identity()));

                Set<Long> retainedOptionIds = new HashSet<>();

                List<Option> optionsToSave = new ArrayList<>();

                for (UpdateQuizSettingsRequest.OptionSettingsRequest request : requests) {

                        Option option;

                        if (request.optionId() == null) {

                                option = new Option();

                                option.setQuestion(question);
                                option.setCreatedAt(LocalDateTime.now());

                        } else {

                                option = existingOptionMap.get(request.optionId());

                                if (option == null) {
                                        throw new BadRequestException(
                                                        "Option does not belong to this question: "
                                                                        + request.optionId());
                                }

                                retainedOptionIds.add(option.getId());
                        }

                        option.setOptionText(request.optionText());
                        option.setOptionImage(request.optionImage());
                        option.setCorrect(
                                        Boolean.TRUE.equals(request.correct()));
                        option.setOptionOrder(request.optionOrder());

                        optionsToSave.add(option);
                }

                /*
                 * Delete removed options.
                 */
                for (Option existing : existingOptions) {

                        if (!retainedOptionIds.contains(existing.getId())) {
                                optionRepository.delete(existing);
                        }
                }

                optionRepository.saveAllAndFlush(optionsToSave);

                List<Option> finalOptions = optionRepository.findByQuestionIdOrderByOptionOrder(
                                question.getId());

                validateOptionsForPublish(question, finalOptions);
        }

        @Transactional
        public QuizResponse completeQuiz(Long quizId, Long teacherId) {

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                if (teacherId == null) {
                        throw new BadRequestException("Teacher authentication is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null
                                || !quiz.getTeacher().getId().equals(teacherId)) {
                        throw new BadRequestException(
                                        "You are not authorized to complete this quiz");
                }

                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "Only a published quiz can be completed");
                }

                quiz.setStatus(QuizStatus.COMPLETED);
                quiz.setExamState(ExamState.ENDED);
                quiz.setUpdatedAt(LocalDateTime.now());

                Quiz savedQuiz = quizRepository.save(quiz);

                return toQuizResponse(savedQuiz);
        }

        @Transactional(readOnly = true)
        public TeacherQuizDetailResponse getTeacherQuizDetail(
                        Long quizId,
                        Long teacherId) {

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                if (teacherId == null) {
                        throw new BadRequestException(
                                        "Teacher authentication is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null
                                || !quiz.getTeacher().getId().equals(teacherId)) {

                        throw new BadRequestException(
                                        "You are not authorized to view this quiz");
                }

                List<TeacherQuizDetailResponse.QuestionDetail> questions = questionRepository
                                .findByQuizIdOrderByDisplayOrder(quizId)
                                .stream()
                                .map(question -> {

                                        List<TeacherQuizDetailResponse.OptionDetail> options = optionRepository
                                                        .findByQuestionIdOrderByOptionOrder(
                                                                        question.getId())
                                                        .stream()
                                                        .map(option -> new TeacherQuizDetailResponse.OptionDetail(
                                                                        option.getId(),
                                                                        option.getOptionText(),
                                                                        option.getOptionImage(),
                                                                        option.isCorrect(),
                                                                        option.getOptionOrder()))
                                                        .toList();

                                        return new TeacherQuizDetailResponse.QuestionDetail(
                                                        question.getId(),
                                                        question.getQuestionText(),
                                                        question.getImageUrl(),
                                                        question.getExplanation(),
                                                        question.getQuestionType(),
                                                        question.getMarks(),
                                                        question.getNegativeMarks(),
                                                        question.getQuestionTimerSeconds(),
                                                        question.getDifficulty(),
                                                        question.getDisplayOrder(),
                                                        options);
                                })
                                .toList();

                return new TeacherQuizDetailResponse(
                                quiz.getId(),
                                quiz.getQuizCode(),
                                quiz.getTeacher().getId(),
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
                                quiz.isTimeBonusEnabled(),
                                quiz.isRandomQuestionOrder(),
                                quiz.isRandomOptionOrder(),
                                quiz.isAllowReview(),
                                quiz.isAllowResume(),
                                quiz.isAutoSubmit(),
                                quiz.getMaxTabSwitch(),
                                quiz.getStartTime(),
                                quiz.getEndTime(),
                                quiz.getResultVisibility(),
                                quiz.isResultsPublished(),
                                quiz.getAcceptedEmailDomain(),
                                quizAllowedStudentRepository.findByQuizId(quiz.getId())
                                                .stream()
                                                .map(QuizAllowedStudent::getRegistrationNumber)
                                                .toList(),
                                quiz.getStatus(),
                                quiz.getExamState(),
                                questions);
        }

        public List<LeaderboardEntryResponse> getLeaderboard(Long quizId, Long teacherId) {

                if (quizId == null) {
                        throw new BadRequestException("Quiz ID is required");
                }

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getTeacher() == null
                                || !quiz.getTeacher().getId().equals(teacherId)) {
                        throw new BadRequestException("You are not authorized to view this leaderboard");
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
}
