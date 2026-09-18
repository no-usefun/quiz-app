package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.entity.ExamState;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;

@Service
@Transactional
public class TeacherQuizService {

    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;

    public TeacherQuizService(QuizRepository quizRepository, QuestionRepository questionRepository,
            OptionRepository optionRepository) {
        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
        this.optionRepository = optionRepository;
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
}
