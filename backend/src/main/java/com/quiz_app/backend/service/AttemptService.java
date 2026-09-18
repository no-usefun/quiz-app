package com.quiz_app.backend.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;

import com.quiz_app.backend.dto.attempt.AnswerResponse;
import com.quiz_app.backend.dto.attempt.AttemptResponse;
import com.quiz_app.backend.dto.attempt.SaveAnswerRequest;
import com.quiz_app.backend.dto.attempt.StartAttemptRequest;
import com.quiz_app.backend.dto.attempt.SubmitAttemptResponse;
import com.quiz_app.backend.entity.AnswerStatus;
import com.quiz_app.backend.entity.AttemptStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizAttempt;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.StudentAnswer;
import com.quiz_app.backend.entity.StudentSelectedOption;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAttemptRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.StudentAnswerRepository;
import com.quiz_app.backend.repository.StudentSelectedOptionRepository;
import com.quiz_app.backend.repository.UserRepository;

import jakarta.transaction.Transactional;

@Service
public class AttemptService {

        private final QuizAttemptRepository quizAttemptRepository;
        private final QuizRepository quizRepository;
        private final UserRepository userRepository;
        private final StudentAnswerRepository studentAnswerRepository;
        private final StudentSelectedOptionRepository studentSelectedOptionRepository;
        private final QuestionRepository questionRepository;
        private final OptionRepository optionRepository;

        public AttemptService(
                        QuizAttemptRepository quizAttemptRepository, QuizRepository quizRepository,
                        UserRepository userRepository,
                        StudentAnswerRepository studentAnswerRepository,
                        StudentSelectedOptionRepository studentSelectedOptionRepository,
                        QuestionRepository questionRepository,
                        OptionRepository optionRepository) {
                this.quizAttemptRepository = quizAttemptRepository;
                this.quizRepository = quizRepository;
                this.userRepository = userRepository;
                this.studentAnswerRepository = studentAnswerRepository;
                this.studentSelectedOptionRepository = studentSelectedOptionRepository;
                this.questionRepository = questionRepository;
                this.optionRepository = optionRepository;
        }

        @Transactional
        public AttemptResponse startAttempt(
                        String quizCode,
                        StartAttemptRequest request) {

                if (quizCode == null || quizCode.isBlank()) {
                        throw new BadRequestException("Quiz code is required");
                }

                if (request == null || request.studentId() == null) {
                        throw new BadRequestException("Student ID is required");
                }

                // 1. Find student
                User student = userRepository.findById(request.studentId())
                                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

                // 2. Verify student role
                if (!"STUDENT".equals(student.getRole().getName())) {
                        throw new BadRequestException(
                                        "Only a student can start a quiz");
                }

                // 3. Find quiz
                Quiz quiz = quizRepository.findByQuizCode(quizCode)
                                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found"));

                // 4. Check quiz status
                if (quiz.getStatus() != QuizStatus.PUBLISHED) {
                        throw new BadRequestException(
                                        "Quiz is not available");
                }

                LocalDateTime now = LocalDateTime.now();

                // 5. Check exam window
                if (quiz.getStartTime() != null &&
                                now.isBefore(quiz.getStartTime())) {

                        throw new BadRequestException(
                                        "Quiz has not started yet");
                }

                if (quiz.getEndTime() != null &&
                                now.isAfter(quiz.getEndTime())) {

                        throw new BadRequestException(
                                        "Quiz has already ended");
                }

                // 6. Prevent duplicate attempt
                if (quizAttemptRepository.existsByQuizQuizCodeAndStudentId(
                                quizCode,
                                student.getId())) {

                        throw new ConflictException(
                                        "Student has already attempted this quiz");
                }

                // 7. Create attempt
                QuizAttempt attempt = new QuizAttempt();

                attempt.setQuiz(quiz);
                attempt.setStudent(student);
                attempt.setStartedAt(now);
                attempt.setStatus(AttemptStatus.IN_PROGRESS);

                attempt.setCurrentQuestion(1);
                attempt.setTotalTimeTaken(0);

                // Phase 2 fields — initial values only
                attempt.setWarningsCount(0);
                attempt.setRefreshCount(0);
                attempt.setReconnectCount(0);

                attempt.setFinalScore(java.math.BigDecimal.ZERO);
                attempt.setCreatedAt(now);

                attempt = quizAttemptRepository.save(attempt);

                // 8. Return safe response
                return new AttemptResponse(
                                attempt.getId(),
                                quiz.getId(),
                                student.getId(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt(),
                                attempt.getStatus(),
                                attempt.getCurrentQuestion(),
                                attempt.getTotalTimeTaken());
        }

        @Transactional
        public AnswerResponse saveAnswer(
                        Long attemptId,
                        Long questionId,
                        SaveAnswerRequest request) {

                if (attemptId == null) {
                        throw new BadRequestException("Attempt ID is required");
                }

                if (questionId == null) {
                        throw new BadRequestException("Question ID is required");
                }

                if (request == null) {
                        throw new BadRequestException("Answer request is required");
                }

                // 1. Find attempt
                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found"));

                // 2. Attempt must still be active
                if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
                        throw new BadRequestException(
                                        "Cannot modify an attempt that is not in progress");
                }

                // 3. Find question
                Question question = questionRepository.findById(questionId)
                                .orElseThrow(() -> new ResourceNotFoundException("Question not found"));

                // 4. Question must belong to this quiz
                if (!question.getQuiz().getId().equals(attempt.getQuiz().getId())) {
                        throw new BadRequestException(
                                        "Question does not belong to this quiz");
                }

                List<Long> selectedIds = request.selectedOptionIds();

                if (selectedIds == null) {
                        selectedIds = List.of();
                }

                // 5. Validate response time
                if (request.responseTimeSeconds() != null
                                && request.responseTimeSeconds() < 0) {

                        throw new BadRequestException(
                                        "Response time cannot be negative");
                }

                // 6. Load selected options
                List<Option> selectedOptions = selectedIds.stream()
                                .map(optionId -> optionRepository.findById(optionId)
                                                .orElseThrow(() -> new ResourceNotFoundException(
                                                                "Option not found: " + optionId)))
                                .toList();

                // 7. Every selected option must belong to this question
                for (Option option : selectedOptions) {

                        if (!option.getQuestion().getId().equals(questionId)) {
                                throw new BadRequestException(
                                                "Selected option does not belong to this question");
                        }
                }

                // 8. Validate number of selections
                validateSelectionCount(question, selectedOptions);

                // 9. Find existing answer or create new one
                StudentAnswer answer = studentAnswerRepository
                                .findByAttemptIdAndQuestionId(
                                                attemptId,
                                                questionId)
                                .orElseGet(StudentAnswer::new);

                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setAnswerStatus(
                                selectedOptions.isEmpty()
                                                ? AnswerStatus.UNANSWERED
                                                : AnswerStatus.ANSWERED);

                // Evaluation happens during submit
                answer.setCorrect(false);
                answer.setMarksAwarded(BigDecimal.ZERO);

                answer.setResponseTimeSeconds(
                                request.responseTimeSeconds());

                answer.setAnsweredAt(
                                selectedOptions.isEmpty()
                                                ? null
                                                : LocalDateTime.now());

                answer = studentAnswerRepository.save(answer);

                // 10. Replace previous selections
                studentSelectedOptionRepository.deleteByAnswerId(
                                answer.getId());

                for (Option option : selectedOptions) {

                        StudentSelectedOption selectedOption = new StudentSelectedOption();

                        selectedOption.setAnswer(answer);
                        selectedOption.setOption(option);
                        selectedOption.setCreatedAt(LocalDateTime.now());

                        studentSelectedOptionRepository.save(selectedOption);
                }

                return new AnswerResponse(
                                answer.getId(),
                                attempt.getId(),
                                question.getId(),
                                selectedOptions.stream()
                                                .map(Option::getId)
                                                .toList(),
                                answer.getResponseTimeSeconds(),
                                answer.getAnsweredAt());
        }

        private void validateSelectionCount(
                        Question question,
                        List<Option> selectedOptions) {

                int count = selectedOptions.size();

                switch (question.getQuestionType()) {

                        case MCQ, TRUE_FALSE -> {

                                if (count > 1) {
                                        throw new BadRequestException(
                                                        "Only one option can be selected");
                                }
                        }

                        case MSQ -> {
                                // Multiple selections are allowed.
                        }
                }
        }

        @Transactional
        public SubmitAttemptResponse submitAttempt(Long attemptId) {

                if (attemptId == null) {
                        throw new BadRequestException("Attempt ID is required");
                }

                // 1. Load attempt
                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> new ResourceNotFoundException(
                                                "Attempt not found with id: " + attemptId));

                // 2. Attempt must still be in progress
                if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
                        throw new ConflictException(
                                        "Attempt has already been submitted");
                }

                Quiz quiz = attempt.getQuiz();

                // 3. Load all questions of the quiz
                List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(
                                quiz.getId());

                // 4. Load all answers already saved by the student
                List<StudentAnswer> existingAnswers = studentAnswerRepository.findByAttemptId(attemptId);

                Map<Long, StudentAnswer> answerMap = new HashMap<>();

                for (StudentAnswer answer : existingAnswers) {
                        answerMap.put(answer.getQuestion().getId(), answer);
                }

                BigDecimal finalScore = BigDecimal.ZERO;

                // 5. Evaluate every question
                for (Question question : questions) {

                        StudentAnswer answer = answerMap.get(question.getId());

                        /*
                         * Student never interacted with this question.
                         * Create an explicit UNANSWERED record.
                         */
                        if (answer == null) {

                                answer = new StudentAnswer();

                                answer.setAttempt(attempt);
                                answer.setQuestion(question);
                                answer.setAnswerStatus(AnswerStatus.UNANSWERED);
                                answer.setCorrect(false);
                                answer.setMarksAwarded(BigDecimal.ZERO);
                                answer.setResponseTimeSeconds(null);
                                answer.setAnsweredAt(null);

                                studentAnswerRepository.save(answer);

                                continue;
                        }

                        /*
                         * Get the options selected by the student.
                         */
                        List<StudentSelectedOption> selectedOptions = studentSelectedOptionRepository
                                        .findByAnswerId(answer.getId());

                        /*
                         * No selected option = unanswered.
                         */
                        if (selectedOptions.isEmpty()) {

                                answer.setAnswerStatus(AnswerStatus.UNANSWERED);
                                answer.setCorrect(false);
                                answer.setMarksAwarded(BigDecimal.ZERO);
                                answer.setAnsweredAt(null);

                                studentAnswerRepository.save(answer);

                                continue;
                        }

                        /*
                         * IDs selected by the student.
                         */
                        Set<Long> selectedOptionIds = new HashSet<>();

                        for (StudentSelectedOption selectedOption : selectedOptions) {
                                selectedOptionIds.add(
                                                selectedOption.getOption().getId());
                        }

                        /*
                         * Get all options belonging to this question.
                         */
                        List<Option> questionOptions = optionRepository
                                        .findByQuestionIdOrderByOptionOrder(
                                                        question.getId());

                        /*
                         * IDs of the correct options.
                         */
                        Set<Long> correctOptionIds = new HashSet<>();

                        for (Option option : questionOptions) {

                                if (option.isCorrect()) {
                                        correctOptionIds.add(option.getId());
                                }
                        }

                        /*
                         * Exact-set comparison.
                         *
                         * MCQ:
                         * student {A}, correct {A} -> correct
                         *
                         * MSQ:
                         * student {A,C}, correct {A,C} -> correct
                         * student {A}, correct {A,C} -> wrong
                         * student {A,B}, correct {A,C} -> wrong
                         */
                        boolean correct = selectedOptionIds.equals(correctOptionIds);

                        answer.setAnswerStatus(AnswerStatus.ANSWERED);
                        answer.setCorrect(correct);

                        BigDecimal marksAwarded;

                        if (correct) {

                                marksAwarded = question.getMarks();

                        } else if (quiz.isNegativeMarking()) {

                                BigDecimal negativeMarks = question.getNegativeMarks();

                                if (negativeMarks == null) {
                                        negativeMarks = BigDecimal.ZERO;
                                }

                                marksAwarded = negativeMarks.negate();

                        } else {

                                marksAwarded = BigDecimal.ZERO;
                        }

                        answer.setMarksAwarded(marksAwarded);

                        studentAnswerRepository.save(answer);

                        finalScore = finalScore.add(marksAwarded);
                }

                // 6. Calculate total time taken
                LocalDateTime submittedAt = LocalDateTime.now();

                int totalTimeTaken = (int) Duration
                                .between(attempt.getStartedAt(), submittedAt)
                                .getSeconds();

                // 7. Update attempt
                attempt.setFinalScore(finalScore);
                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setSubmittedAt(submittedAt);
                attempt.setTotalTimeTaken(totalTimeTaken);

                quizAttemptRepository.save(attempt);

                // 8. Return result
                return new SubmitAttemptResponse(
                                attempt.getId(),
                                quiz.getId(),
                                attempt.getStatus(),
                                attempt.getFinalScore(),
                                quiz.getTotalMarks(),
                                attempt.getTotalTimeTaken(),
                                attempt.getSubmittedAt());
        }
}