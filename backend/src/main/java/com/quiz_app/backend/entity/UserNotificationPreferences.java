package com.quiz_app.backend.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "user_notification_preferences")
public class UserNotificationPreferences {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "preference_id")
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "assessment_results", nullable = false)
    private boolean assessmentResults = true;

    @Column(name = "upcoming_assessments", nullable = false)
    private boolean upcomingAssessments = true;

    @Column(name = "proctoring_reports", nullable = false)
    private boolean proctoringReports = false;

    @Column(name = "browser_push", nullable = false)
    private boolean browserPush = false;

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public boolean isAssessmentResults() { return assessmentResults; }
    public void setAssessmentResults(boolean value) { this.assessmentResults = value; }
    public boolean isUpcomingAssessments() { return upcomingAssessments; }
    public void setUpcomingAssessments(boolean value) { this.upcomingAssessments = value; }
    public boolean isProctoringReports() { return proctoringReports; }
    public void setProctoringReports(boolean value) { this.proctoringReports = value; }
    public boolean isBrowserPush() { return browserPush; }
    public void setBrowserPush(boolean value) { this.browserPush = value; }
}
