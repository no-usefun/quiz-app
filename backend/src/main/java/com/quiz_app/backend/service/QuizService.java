package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.exam.OptionResponse;
import com.quiz_app.backend.dto.exam.QuestionResponse;
import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.OptionRequest;
import com.quiz_app.backend.dto.quiz.QuestionRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.ResultVisibility;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.transaction.Transactional;

@Service
public class QuizService {

        private final QuizRepository quizRepository;
        private final QuestionRepository questionRepository;
        private final OptionRepository optionRepository;
        private final UserRepository userRepository;

        public QuizService(
                        QuizRepository quizRepository,
                        QuestionRepository questionRepository,
                        OptionRepository optionRepository,
                        UserRepository userRepository) {
                this.quizRepository = quizRepository;
                this.questionRepository = questionRepository;
                this.optionRepository = optionRepository;
                this.userRepository = userRepository;
        }

        @Transactional
        public QuizResponse createQuiz(
                        CreateQuizRequest request,
                        Long teacherId) {

                // 1. Find teacher
                if (teacherId == null) {
                        throw new BadRequestException(
                                        "Teacher authentication is required");
                }

                User teacher = userRepository.findById(teacherId)
                                .orElseThrow(() -> new ResourceNotFoundException("Teacher not found"));

                // 2. Validate teacher role
                if (!"TEACHER".equals(teacher.getRole().getName())) {
                        throw new BadRequestException(
                                        "Only a teacher can create a quiz");
                }

                // 3. Validate quiz-level data
                validateQuiz(request);

                // 4. Create Quiz entity
                Quiz quiz = new Quiz();

                quiz.setQuizCode(generateUniqueQuizCode());
                quiz.setTeacher(teacher);
                quiz.setTitle(request.title());
                quiz.setDescription(request.description());
                quiz.setInstructions(request.instructions());

                quiz.setSubject(request.subject());
                quiz.setSubjectCode(request.subjectCode());
                quiz.setTotalStudents(request.totalStudents());

                quiz.setResultVisibility(
                                request.resultVisibility() != null
                                                ? request.resultVisibility()
                                                : ResultVisibility.NONE);

                quiz.setResultsPublished(false);

                quiz.setOverallTimerSeconds(request.overallTimerSeconds());

                quiz.setNegativeMarking(request.negativeMarking());
                quiz.setNegativeMarks(
                                request.negativeMarks() != null
                                                ? request.negativeMarks()
                                                : BigDecimal.ZERO);

                quiz.setTimeBonusEnabled(request.timeBonusEnabled());
                quiz.setRandomQuestionOrder(request.randomQuestionOrder());
                quiz.setRandomOptionOrder(request.randomOptionOrder());
                quiz.setAllowReview(request.allowReview());
                quiz.setAllowResume(request.allowResume());
                quiz.setAutoSubmit(request.autoSubmit());

                // Phase 2 field
                // Keep the DB value, but don't implement proctoring logic now.
                quiz.setMaxTabSwitch(3);

                quiz.setStartTime(request.startTime());
                quiz.setEndTime(request.endTime());

                // Initial values
                quiz.setTotalQuestions(request.questions().size());
                quiz.setTotalMarks(calculateTotalMarks(request));

                /*
                 * These enum values may need to match the exact defaults
                 * in your database schema.
                 */
                quiz.setStatus(QuizStatus.DRAFT);

                quiz.setExamState(ExamState.WAITING);

                quiz.setCreatedAt(LocalDateTime.now());
                quiz.setUpdatedAt(LocalDateTime.now());

                // 5. Save quiz first because questions need quiz_id
                quiz = quizRepository.save(quiz);

                // 6. Create questions and options
                for (QuestionRequest questionRequest : request.questions()) {

                        validateQuestion(questionRequest);

                        Question question = new Question();

                        question.setQuiz(quiz);
                        question.setQuestionText(questionRequest.questionText());
                        question.setImageUrl(questionRequest.imageUrl());
                        question.setExplanation(questionRequest.explanation());

                        question.setQuestionType(questionRequest.questionType());
                        question.setMarks(questionRequest.marks());
                        question.setNegativeMarks(
                                        questionRequest.negativeMarks() != null
                                                        ? questionRequest.negativeMarks()
                                                        : BigDecimal.ZERO);

                        question.setQuestionTimerSeconds(
                                        questionRequest.questionTimerSeconds());

                        question.setDifficulty(questionRequest.difficulty());
                        question.setDisplayOrder(questionRequest.displayOrder());

                        question.setCreatedAt(LocalDateTime.now());
                        question.setUpdatedAt(LocalDateTime.now());

                        question = questionRepository.save(question);

                        // 7. Create options
                        for (OptionRequest optionRequest : questionRequest.options()) {

                                Option option = new Option();

                                option.setQuestion(question);
                                option.setOptionText(optionRequest.optionText());
                                option.setOptionImage(optionRequest.optionImage());
                                option.setCorrect(optionRequest.isCorrect());
                                option.setOptionOrder(optionRequest.optionOrder());
                                option.setCreatedAt(LocalDateTime.now());

                                optionRepository.save(option);
                        }
                }

                return new QuizResponse(
                                quiz.getId(),
                                quiz.getQuizCode(),
                                teacher.getId(),

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

                                quiz.getStatus(),
                                quiz.getExamState());
        }

        private void validateQuiz(CreateQuizRequest request) {

                if (request.title() == null || request.title().isBlank()) {
                        throw new BadRequestException(
                                        "Quiz title is required");
                }

                if (request.subject() == null || request.subject().isBlank()) {
                        throw new BadRequestException(
                                        "Subject is required");
                }

                if (request.subjectCode() == null ||
                                request.subjectCode().isBlank()) {

                        throw new BadRequestException(
                                        "Subject code is required");
                }

                if (request.totalStudents() == null ||
                                request.totalStudents() < 0) {

                        throw new BadRequestException(
                                        "Total students cannot be negative");
                }

                if (request.questions() == null ||
                                request.questions().isEmpty()) {

                        throw new BadRequestException(
                                        "Quiz must contain at least one question");
                }

                if (request.resultVisibility() == null) {
                        throw new BadRequestException(
                                        "Quiz must have a result visibility declaration");
                }

                if (request.negativeMarking()
                                && request.negativeMarks() != null
                                && request.negativeMarks()
                                                .compareTo(BigDecimal.ZERO) < 0) {

                        throw new BadRequestException(
                                        "Negative marks cannot be negative");
                }
        }

        private void validateQuestion(QuestionRequest request) {

                if ((request.questionText() == null ||
                                request.questionText().isBlank())
                                && (request.imageUrl() == null ||
                                                request.imageUrl().isBlank())) {

                        throw new BadRequestException(
                                        "Question must contain text or an image");
                }

                if (request.questionType() == null) {
                        throw new BadRequestException(
                                        "Question type is required");
                }

                if (request.marks() == null ||
                                request.marks().compareTo(BigDecimal.ZERO) <= 0) {

                        throw new BadRequestException(
                                        "Question marks must be greater than zero");
                }

                if (request.options() == null ||
                                request.options().isEmpty()) {

                        throw new BadRequestException(
                                        "Question must contain options");
                }

                long correctOptions = request.options()
                                .stream()
                                .filter(option -> option != null && option.isCorrect())
                                .count();

                switch (request.questionType()) {

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

                                if (request.options().size() != 2) {
                                        throw new BadRequestException(
                                                        "TRUE_FALSE must have exactly two options");
                                }

                                if (correctOptions != 1) {
                                        throw new BadRequestException(
                                                        "TRUE_FALSE must have exactly one correct option");
                                }
                        }
                }

                for (OptionRequest option : request.options()) {
                        validateOption(option);
                }
        }

        private void validateOption(OptionRequest request) {

                if ((request.optionText() == null ||
                                request.optionText().isBlank())
                                && (request.optionImage() == null ||
                                                request.optionImage().isBlank())) {

                        throw new BadRequestException(
                                        "Option must contain text or an image");
                }

                if (request.optionOrder() == null ||
                                request.optionOrder() <= 0) {

                        throw new BadRequestException(
                                        "Option order must be greater than zero");
                }
        }

        private BigDecimal calculateTotalMarks(
                        CreateQuizRequest request) {

                return request.questions()
                                .stream()
                                .map(question -> question.marks())
                                .reduce(BigDecimal.ZERO, (a, b) -> a.add(b != null ? b : BigDecimal.ZERO));
        }

        public QuizPackageResponse getQuizPackageByCode(String quizCode) {

                Quiz quiz = quizRepository.findByQuizCode(quizCode)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                return getQuizPackage(quiz.getId());
        }

        public QuizPackageResponse getQuizPackage(Long quizId) {

                Quiz quiz = quizRepository.findById(quizId)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "Quiz is not available to students");
                }

                var questions = questionRepository
                                .findByQuizIdOrderByDisplayOrder(quizId);

                var questionResponses = questions.stream()
                                .map(question -> {

                                        var options = optionRepository
                                                        .findByQuestionIdOrderByOptionOrder(
                                                                        question.getId());

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

        private String generateUniqueQuizCode() {

                String code;

                do {
                        code = String.format(
                                        "%06d",
                                        ThreadLocalRandom.current()
                                                        .nextInt(0, 1_000_000));
                } while (quizRepository.existsByQuizCode(code));

                return code;
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
}