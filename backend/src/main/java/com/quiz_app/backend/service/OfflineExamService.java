package com.quiz_app.backend.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.quiz_app.backend.dto.exam.OfflineExamStatusResponse;
import com.quiz_app.backend.entity.OfflineExam;
import com.quiz_app.backend.entity.OfflineExamStatus;
import com.quiz_app.backend.entity.Option;
import com.quiz_app.backend.entity.Question;
import com.quiz_app.backend.entity.Quiz;
import com.quiz_app.backend.entity.QuizStatus;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.OfflineExamRepository;
import com.quiz_app.backend.repository.OptionRepository;
import com.quiz_app.backend.repository.QuestionRepository;
import com.quiz_app.backend.repository.QuizAllowedStudentRepository;
import com.quiz_app.backend.repository.QuizRepository;
import com.quiz_app.backend.repository.UserRepository;

@Service
public class OfflineExamService {
    private final OfflineExamRepository offlineExamRepository;
    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final OptionRepository optionRepository;
    private final QuizAllowedStudentRepository allowedStudentRepository;
    private final UserRepository userRepository;
    private final Clock clock;

    public OfflineExamService(OfflineExamRepository offlineExamRepository, QuizRepository quizRepository,
            QuestionRepository questionRepository, OptionRepository optionRepository,
            QuizAllowedStudentRepository allowedStudentRepository, UserRepository userRepository, Clock clock) {
        this.offlineExamRepository = offlineExamRepository;
        this.quizRepository = quizRepository;
        this.questionRepository = questionRepository;
        this.optionRepository = optionRepository;
        this.allowedStudentRepository = allowedStudentRepository;
        this.userRepository = userRepository;
        this.clock = clock;
    }

    @Transactional
    public OfflineExamStatusResponse prepare(Long quizId, Long teacherId) {
        Quiz quiz = getOwnedQuiz(quizId, teacherId);
        if (quiz.getStatus() != QuizStatus.PUBLISHED) {
            throw new BadRequestException("OFFLINE_EXAM_NOT_PUBLISHED", "Quiz must be published before offline preparation");
        }

        OfflineExam existing = offlineExamRepository.findByQuizId(quizId).orElse(null);
        if (existing != null && existing.getStatus() == OfflineExamStatus.RUNNING) {
            throw new BadRequestException("OFFLINE_EXAM_RUNNING", "A running offline exam cannot be prepared again");
        }

        int questionCount = validateLocalSnapshot(quiz);
        int allowedCount = (int) allowedStudentRepository.countByQuizId(quizId);
        LocalDateTime now = LocalDateTime.now(clock);

        OfflineExam exam = existing != null ? existing : new OfflineExam();
        exam.setQuiz(quiz);
        exam.setStatus(OfflineExamStatus.READY);
        exam.setPreparedAt(now);
        exam.setStartedAt(null);
        exam.setEndedAt(null);
        exam.setUpdatedAt(now);
        offlineExamRepository.save(exam);

        return response(exam, true, questionCount, allowedCount);
    }

    @Transactional(readOnly = true)
    public OfflineExamStatusResponse status(Long quizId, Long teacherId) {
        Quiz quiz = getOwnedQuiz(quizId, teacherId);
        OfflineExam exam = offlineExamRepository.findByQuizId(quizId)
                .orElseThrow(() -> new ResourceNotFoundException("OFFLINE_EXAM_NOT_PREPARED", "Offline exam has not been prepared"));
        int questionCount = questionRepository.findByQuizIdOrderByDisplayOrder(quizId).size();
        int allowedCount = (int) allowedStudentRepository.countByQuizId(quizId);
        return response(exam, questionCount > 0, questionCount, allowedCount);
    }

    @Transactional
    public OfflineExamStatusResponse start(Long quizId, Long teacherId) {
        Quiz quiz = getOwnedQuiz(quizId, teacherId);
        OfflineExam exam = getExam(quizId);
        if (exam.getStatus() != OfflineExamStatus.READY) {
            throw new BadRequestException("OFFLINE_EXAM_NOT_READY", "Offline exam must be READY before it can start");
        }
        if (offlineExamRepository.findFirstByStatus(OfflineExamStatus.RUNNING).filter(e -> !e.getQuiz().getId().equals(quizId)).isPresent()) {
            throw new BadRequestException("OFFLINE_EXAM_ALREADY_RUNNING", "Another offline exam is already running");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        exam.setStatus(OfflineExamStatus.RUNNING);
        exam.setStartedAt(now);
        exam.setEndedAt(null);
        exam.setUpdatedAt(now);
        quiz.setExamState(com.quiz_app.backend.entity.ExamState.RUNNING);
        quizRepository.save(quiz);
        offlineExamRepository.save(exam);
        return status(quizId, teacherId);
    }

    @Transactional
    public OfflineExamStatusResponse end(Long quizId, Long teacherId) {
        Quiz quiz = getOwnedQuiz(quizId, teacherId);
        OfflineExam exam = getExam(quizId);
        if (exam.getStatus() != OfflineExamStatus.RUNNING) {
            throw new BadRequestException("OFFLINE_EXAM_NOT_RUNNING", "Offline exam is not running");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        exam.setStatus(OfflineExamStatus.ENDED);
        exam.setEndedAt(now);
        exam.setUpdatedAt(now);
        quiz.setExamState(com.quiz_app.backend.entity.ExamState.ENDED);
        offlineExamRepository.save(exam);
        quizRepository.save(quiz);
        return status(quizId, teacherId);
    }

    private Quiz getOwnedQuiz(Long quizId, Long teacherId) {
        if (quizId == null || teacherId == null) throw new BadRequestException("QUIZ_AND_TEACHER_REQUIRED", "Quiz and teacher are required");
        Quiz quiz = quizRepository.findById(quizId).orElseThrow(() -> new ResourceNotFoundException("QUIZ_NOT_FOUND", "Quiz not found"));
        if (quiz.getTeacher() == null || !teacherId.equals(quiz.getTeacher().getId())) throw new BadRequestException("QUIZ_OWNERSHIP_REQUIRED", "You do not own this quiz");
        return quiz;
    }

    private OfflineExam getExam(Long quizId) {
        return offlineExamRepository.findByQuizId(quizId).orElseThrow(() -> new ResourceNotFoundException("OFFLINE_EXAM_NOT_PREPARED", "Offline exam has not been prepared"));
    }

    private int validateLocalSnapshot(Quiz quiz) {
        User teacher = quiz.getTeacher();
        if (teacher == null || teacher.getRole() == null || !"TEACHER".equalsIgnoreCase(teacher.getRole().getName()) || !teacher.isActive())
            throw new BadRequestException("OFFLINE_TEACHER_NOT_READY", "Required teacher account is missing or inactive in the local database");

        List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(quiz.getId());
        if (questions.size() != quiz.getTotalQuestions())
            throw new BadRequestException("OFFLINE_QUESTION_DATA_INCOMPLETE", "Local database does not contain all quiz questions");

        for (Question question : questions) {
            List<Option> options = optionRepository.findByQuestionIdOrderByOptionOrder(question.getId());
            if (options.isEmpty()) throw new BadRequestException("OFFLINE_OPTION_DATA_INCOMPLETE", "Question " + question.getId() + " has no options");
            if (options.stream().noneMatch(Option::isCorrect)) throw new BadRequestException("OFFLINE_CORRECT_ANSWER_MISSING", "Question " + question.getId() + " has no correct answer");
        }

        var allowed = allowedStudentRepository.findByQuizId(quiz.getId());
        if (allowed.isEmpty()) throw new BadRequestException("OFFLINE_STUDENTS_MISSING", "No allowed students are prepared for this exam");
        for (var entry : allowed) {
            User student = userRepository.findByRegistrationNo(entry.getRegistrationNumber()).orElse(null);
            if (student == null || !student.isActive() || student.getRole() == null || !"STUDENT".equalsIgnoreCase(student.getRole().getName()) || student.getPasswordHash() == null)
                throw new BadRequestException("OFFLINE_STUDENT_DATA_INCOMPLETE", "Student " + entry.getRegistrationNumber() + " is missing required local account data");
        }
        return questions.size();
    }

    private OfflineExamStatusResponse response(OfflineExam exam, boolean ready, int questionCount, int allowedCount) {
        Quiz quiz = exam.getQuiz();
        return new OfflineExamStatusResponse(quiz.getId(), quiz.getQuizCode(), quiz.getTitle(), exam.getStatus().name(), ready, questionCount, allowedCount, exam.getPreparedAt(), exam.getStartedAt(), exam.getEndedAt());
    }
}
