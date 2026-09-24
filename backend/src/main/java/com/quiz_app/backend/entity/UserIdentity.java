package com.quiz_app.backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_identities", uniqueConstraints = {
        @UniqueConstraint(name = "uq_user_identity", columnNames = { "issuer", "subject" })
}, indexes = {
        @Index(name = "idx_user_identities_user_id", columnList = "user_id")
})
public class UserIdentity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "identity_id")
    private Long identityId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_identity_user"))
    private User user;

    @Column(name = "provider", nullable = false, length = 30)
    private String provider;

    @Column(name = "issuer", nullable = false, length = 500)
    private String issuer;

    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getIdentityId() {
        return identityId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getIssuer() {
        return issuer;
    }

    public void setIssuer(String issuer) {
        this.issuer = issuer;
    }

    public String getSubject() {
        return subject;
    }

    public void setSubject(String subject) {
        this.subject = subject;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}