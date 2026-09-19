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
import com.quiz_app.backend.entity.Difficulty;
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
                int questionOrder = 1;

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

                        question.setDifficulty(
                                        questionRequest.difficulty() != null
                                                        ? questionRequest.difficulty()
                                                        : Difficulty.EASY);

                        // Generate question order on the backend
                        question.setDisplayOrder(questionOrder++);

                        question.setCreatedAt(LocalDateTime.now());
                        question.setUpdatedAt(LocalDateTime.now());

                        question = questionRepository.save(question);

                        // Create options
                        // 7. Create options
                        int optionOrder = 1;

                        for (OptionRequest optionRequest : questionRequest.options()) {

                                Option option = new Option();

                                option.setQuestion(question);
                                option.setOptionText(optionRequest.optionText());
                                option.setOptionImage(optionRequest.optionImage());
                                option.setCorrect(optionRequest.isCorrect());

                                // Generate option order on the backend
                                option.setOptionOrder((short) optionOrder++);

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
                if (request == null) {
                        throw new BadRequestException(
                                        "Option cannot be null");
                }

                if ((request.optionText() == null ||
                                request.optionText().isBlank())
                                && (request.optionImage() == null ||
                                                request.optionImage().isBlank())) {

                        throw new BadRequestException(
                                        "Option must contain text or an image");
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
}