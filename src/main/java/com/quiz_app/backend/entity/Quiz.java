package com.quiz_app.backend.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "quizzes")
public class Quiz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "quiz_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "teacher_id", nullable = false)
    private User teacher;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Column(name = "description")
    private String description;

    @Column(name = "instructions")
    private String instructions;

    @Column(name = "subject", nullable = false, length = 100)
    private String subject;

    @Column(name = "subject_code", nullable = false, length = 50)
    private String subjectCode;

    @Column(name = "total_students")
    private Integer totalStudents;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "total_marks", nullable = false, precision = 8, scale = 2)
    private BigDecimal totalMarks;

    @Column(name = "overall_timer_seconds", nullable = false)
    private Integer overallTimerSeconds;

    @Column(name = "negative_marking", nullable = false)
    private boolean negativeMarking;

    @Column(name = "negative_marks", nullable = false, precision = 5, scale = 2)
    private BigDecimal negativeMarks;

    @Column(name = "time_bonus_enabled", nullable = false)
    private boolean timeBonusEnabled;

    @Column(name = "random_question_order", nullable = false)
    private boolean randomQuestionOrder;

    @Column(name = "random_option_order", nullable = false)
    private boolean randomOptionOrder;

    @Column(name = "allow_review", nullable = false)
    private boolean allowReview;

    @Column(name = "allow_resume", nullable = false)
    private boolean allowResume;

    @Column(name = "auto_submit", nullable = false)
    private boolean autoSubmit;

    // Phase 2 / proctoring-related field.
    // Keep it in the entity because it exists in the database.
    // We will not implement its business logic in Phase 1.
    @Column(name = "max_tab_switch", nullable = false)
    private Integer maxTabSwitch;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private QuizStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "exam_state", nullable = false, length = 20)
    private ExamState examState;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public Quiz() {
    }

    public Long getId() {
        return id;
    }

    public User getTeacher() {
        return teacher;
    }

    public void setTeacher(User teacher) {
        this.teacher = teacher;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public String getSubjectCode() {
        return subjectCode;
    }

    public void setSubjectCode(String subjectCode) {
        this.subjectCode = subjectCode;
    }

    public Integer getTotalStudents() {
        return totalStudents;
    }

    public void setTotalStudents(Integer totalStudents) {
        this.totalStudents = totalStudents;
    }

    public Integer getTotalQuestions() {
        return totalQuestions;
    }

    public void setTotalQuestions(Integer totalQuestions) {
        this.totalQuestions = totalQuestions;
    }

    public BigDecimal getTotalMarks() {
        return totalMarks;
    }

    public void setTotalMarks(BigDecimal totalMarks) {
        this.totalMarks = totalMarks;
    }

    public Integer getOverallTimerSeconds() {
        return overallTimerSeconds;
    }

    public void setOverallTimerSeconds(Integer overallTimerSeconds) {
        this.overallTimerSeconds = overallTimerSeconds;
    }

    public boolean isNegativeMarking() {
        return negativeMarking;
    }

    public void setNegativeMarking(boolean negativeMarking) {
        this.negativeMarking = negativeMarking;
    }

    public BigDecimal getNegativeMarks() {
        return negativeMarks;
    }

    public void setNegativeMarks(BigDecimal negativeMarks) {
        this.negativeMarks = negativeMarks;
    }

    public boolean isTimeBonusEnabled() {
        return timeBonusEnabled;
    }

    public void setTimeBonusEnabled(boolean timeBonusEnabled) {
        this.timeBonusEnabled = timeBonusEnabled;
    }

    public boolean isRandomQuestionOrder() {
        return randomQuestionOrder;
    }

    public void setRandomQuestionOrder(boolean randomQuestionOrder) {
        this.randomQuestionOrder = randomQuestionOrder;
    }

    public boolean isRandomOptionOrder() {
        return randomOptionOrder;
    }

    public void setRandomOptionOrder(boolean randomOptionOrder) {
        this.randomOptionOrder = randomOptionOrder;
    }

    public boolean isAllowReview() {
        return allowReview;
    }

    public void setAllowReview(boolean allowReview) {
        this.allowReview = allowReview;
    }

    public boolean isAllowResume() {
        return allowResume;
    }

    public void setAllowResume(boolean allowResume) {
        this.allowResume = allowResume;
    }

    public boolean isAutoSubmit() {
        return autoSubmit;
    }

    public void setAutoSubmit(boolean autoSubmit) {
        this.autoSubmit = autoSubmit;
    }

    public Integer getMaxTabSwitch() {
        return maxTabSwitch;
    }

    public void setMaxTabSwitch(Integer maxTabSwitch) {
        this.maxTabSwitch = maxTabSwitch;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }

    public QuizStatus getStatus() {
        return status;
    }

    public void setStatus(QuizStatus status) {
        this.status = status;
    }

    public ExamState getExamState() {
        return examState;
    }

    public void setExamState(ExamState examState) {
        this.examState = examState;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}