package com.quiz_app.backend.service;

import java.math.BigDecimal;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.exam.OptionResponse;
import com.quiz_app.backend.dto.exam.QuestionResponse;
import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.dto.quiz.CreateQuizRequest;
import com.quiz_app.backend.dto.quiz.OptionRequest;
import com.quiz_app.backend.dto.quiz.QuestionRequest;
import com.quiz_app.backend.dto.quiz.QuizResponse;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.User;
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
    public QuizResponse createQuiz(CreateQuizRequest request) {

        // 1. Validate teacher
        User teacher = userRepository.findById(request.teacherId())
                .orElseThrow(() -> new IllegalArgumentException("Teacher not found"));

        // 2. Validate teacher role
        if (!"TEACHER".equals(teacher.getRole().getRoleName())) {
            throw new IllegalArgumentException(
                    "Only a teacher can create a quiz");
        }

        // 3. Validate quiz-level data
        validateQuiz(request);

        // 4. Create Quiz entity
        Quiz quiz = new Quiz();

        quiz.setTeacher(teacher);
        quiz.setTitle(request.title());
        quiz.setDescription(request.description());
        quiz.setInstructions(request.instructions());

        quiz.setSubject(request.subject());
        quiz.setSubjectCode(request.subjectCode());
        quiz.setTotalStudents(request.totalStudents());

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
        quiz.setStatus(
                com.quiz_app.backend.entity.QuizStatus.DRAFT);

        quiz.setExamState(
                com.quiz_app.backend.entity.ExamState.WAITING);

        quiz.setCreatedAt(java.time.LocalDateTime.now());
        quiz.setUpdatedAt(java.time.LocalDateTime.now());

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

            question.setCreatedAt(java.time.LocalDateTime.now());
            question.setUpdatedAt(java.time.LocalDateTime.now());

            question = questionRepository.save(question);

            // 7. Create options
            for (OptionRequest optionRequest : questionRequest.options()) {

                Option option = new Option();

                option.setQuestion(question);
                option.setOptionText(optionRequest.optionText());
                option.setOptionImage(optionRequest.optionImage());
                option.setCorrect(optionRequest.isCorrect());
                option.setOptionOrder(optionRequest.optionOrder());
                option.setCreatedAt(java.time.LocalDateTime.now());

                optionRepository.save(option);
            }
        }

        return new QuizResponse(
                quiz.getId(),
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

                quiz.getStatus(),
                quiz.getExamState());
    }

    private void validateQuiz(CreateQuizRequest request) {

        if (request.teacherId() == null) {
            throw new IllegalArgumentException(
                    "Teacher ID is required");
        }

        if (request.title() == null || request.title().isBlank()) {
            throw new IllegalArgumentException(
                    "Quiz title is required");
        }

        if (request.subject() == null || request.subject().isBlank()) {
            throw new IllegalArgumentException(
                    "Subject is required");
        }

        if (request.subjectCode() == null ||
                request.subjectCode().isBlank()) {

            throw new IllegalArgumentException(
                    "Subject code is required");
        }

        if (request.totalStudents() == null ||
                request.totalStudents() < 0) {

            throw new IllegalArgumentException(
                    "Total students cannot be negative");
        }

        if (request.questions() == null ||
                request.questions().isEmpty()) {

            throw new IllegalArgumentException(
                    "Quiz must contain at least one question");
        }

        if (request.negativeMarking()
                && request.negativeMarks() != null
                && request.negativeMarks().compareTo(BigDecimal.ZERO) < 0) {

            throw new IllegalArgumentException(
                    "Negative marks cannot be negative");
        }
    }

    private void validateQuestion(QuestionRequest request) {

        if ((request.questionText() == null ||
                request.questionText().isBlank())
                && (request.imageUrl() == null ||
                        request.imageUrl().isBlank())) {

            throw new IllegalArgumentException(
                    "Question must contain text or an image");
        }

        if (request.questionType() == null) {
            throw new IllegalArgumentException(
                    "Question type is required");
        }

        if (request.marks() == null ||
                request.marks().compareTo(BigDecimal.ZERO) <= 0) {

            throw new IllegalArgumentException(
                    "Question marks must be greater than zero");
        }

        if (request.options() == null ||
                request.options().isEmpty()) {

            throw new IllegalArgumentException(
                    "Question must contain options");
        }

        long correctOptions = request.options()
                .stream()
                .filter(OptionRequest::isCorrect)
                .count();

        switch (request.questionType()) {

            case MCQ -> {
                if (correctOptions != 1) {
                    throw new IllegalArgumentException(
                            "MCQ must have exactly one correct option");
                }
            }

            case MSQ -> {
                if (correctOptions < 1) {
                    throw new IllegalArgumentException(
                            "MSQ must have at least one correct option");
                }
            }

            case TRUE_FALSE -> {
                if (request.options().size() != 2) {
                    throw new IllegalArgumentException(
                            "TRUE_FALSE must have exactly two options");
                }

                if (correctOptions != 1) {
                    throw new IllegalArgumentException(
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

            throw new IllegalArgumentException(
                    "Option must contain text or an image");
        }

        if (request.optionOrder() == null ||
                request.optionOrder() <= 0) {

            throw new IllegalArgumentException(
                    "Option order must be greater than zero");
        }
    }

    private BigDecimal calculateTotalMarks(
            CreateQuizRequest request) {

        return request.questions()
                .stream()
                .map(QuestionRequest::marks)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);
    }

    public QuizPackageResponse getQuizPackage(Long quizId) {

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new IllegalArgumentException("Quiz not found"));

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
}