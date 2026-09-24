package com.quiz_app.backend.service;

import java.util.ArrayList;
import java.util.Collections;

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
