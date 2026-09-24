package com.quiz_app.backend.repository;

import com.quiz_app.backend.entity.UserIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    Optional<UserIdentity> findByIssuerAndSubject(
            String issuer,
            String subject);

    boolean existsByIssuerAndSubject(
            String issuer,
            String subject);
}