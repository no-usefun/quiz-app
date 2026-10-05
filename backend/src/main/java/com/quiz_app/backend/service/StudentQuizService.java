package com.quiz_app.backend.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Random;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.exam.OptionResponse;
import com.quiz_app.backend.dto.exam.QuestionResponse;
import com.quiz_app.backend.dto.exam.QuizPackageResponse;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizRepository;

@Service
public class StudentQuizService {

    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;

    public StudentQuizService(
            QuizRepository quizRepository,
            QuestionRepository questionRepository,
            OptionRepository optionRepository) {
        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
        this.optionRepository = optionRepository;
    }

    public QuizPackageResponse getQuizPackage(Long quizId) {
        return getQuizPackage(quizId, null);
    }

    public QuizPackageResponse getQuizPackage(Long quizId, Long studentId) {

        Quiz quiz = quizRepository.findById(quizId)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

        if (quiz.getStatus() != QuizStatus.PUBLISHED) {
            throw new BadRequestException("Quiz is not available to students");
        }

        /*
         * A deterministic seed makes randomized ordering stable across refreshes.
         * The authenticated student's ID is included when available so different
         * students receive different stable orders. There is only one attempt per
         * student/quiz in the current data model.
         */
        long seed = 31L * quiz.getId()
                + (studentId == null ? 0L : studentId);
        Random random = new Random(seed);

        var questions = new ArrayList<>(
                questionRepository.findByQuizIdOrderByDisplayOrder(quizId));

        if (quiz.isRandomQuestionOrder()) {
            Collections.shuffle(questions, random);
        }

        var questionResponses = questions.stream()
                .map(question -> {

                    var options = new ArrayList<>(
                            optionRepository.findByQuestionIdOrderByOptionOrder(question.getId()));

                    if (quiz.isRandomOptionOrder()) {
                        long optionSeed = seed ^ (31L * question.getId());
                        Collections.shuffle(options, new Random(optionSeed));
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
        return getQuizPackageByCode(quizCode, null);
    }

    public QuizPackageResponse getQuizPackageByCode(String quizCode, Long studentId) {

        Quiz quiz = quizRepository.findByQuizCode(quizCode)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

        return getQuizPackage(quiz.getId(), studentId);
    }
}
