package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.quiz_app.backend.entity.Option;

public interface OptionRepository extends JpaRepository<Option, Long> {

    List<Option> findByQuestionIdOrderByOptionOrder(Long questionId);
}