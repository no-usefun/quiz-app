package com.quiz_app.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.UserIdentity;

@Repository
public interface UserIdentityRepository extends JpaRepository<UserIdentity, Long> {

    Optional<UserIdentity> findByIssuerAndSubject(String issuer, String subject);

    boolean existsByIssuerAndSubject(String issuer, String subject);

    List<UserIdentity> findByUserId(Long userId);
}
