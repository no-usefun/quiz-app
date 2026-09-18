package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.StudentSelectedOption;

public interface StudentSelectedOptionRepository
        extends JpaRepository<StudentSelectedOption, Long> {

    List<StudentSelectedOption> findByAnswerId(Long answerId);

    void deleteByAnswerId(Long answerId);
}