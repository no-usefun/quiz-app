package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.UserIdentity;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    /**
     * Loads the OAuth identity together with its User and Role.
     *
     * UserIdentity.user is LAZY, while the OAuth success handler needs the User
     * after the repository call has returned (for role validation, JWT creation,
     * and the response DTO). JOIN FETCH prevents a detached Hibernate proxy from
     * being accessed outside the persistence context.
     */
    @Query("""
            SELECT ui
            FROM UserIdentity ui
            JOIN FETCH ui.user u
            JOIN FETCH u.role
            WHERE ui.issuer = :issuer
              AND ui.subject = :subject
            """)
    Optional<UserIdentity> findByIssuerAndSubject(
            @Param("issuer") String issuer,
            @Param("subject") String subject);

    boolean existsByIssuerAndSubject(
            String issuer,
            String subject);

    List<UserIdentity> findByUserId(Long userId);
}
