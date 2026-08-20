package com.quiz_app.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.quiz_app.backend.entity.Device;

@Repository
public interface DeviceRepository extends JpaRepository<Device, Long> {

    List<Device> findByAttemptId(Long attemptId);
}
