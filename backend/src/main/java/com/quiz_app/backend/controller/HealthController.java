package com.quiz_app.backend.controller;

import java.sql.Connection;
import java.util.LinkedHashMap;
import java.util.Map;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.entity.OfflineExam;
import com.quiz_app.backend.repository.OfflineExamRepository;

@RestController
public class HealthController {
    private final DataSource dataSource;
    private final OfflineExamRepository offlineExamRepository;
    private final String examMode;

    public HealthController(DataSource dataSource, OfflineExamRepository offlineExamRepository,
            @Value("${app.exam.mode:ONLINE}") String examMode) {
        this.dataSource = dataSource;
        this.offlineExamRepository = offlineExamRepository;
        this.examMode = examMode;
    }

    @GetMapping("/api/v1/health")
    public ResponseEntity<Map<String, Object>> health() {
        boolean databaseConnected = isDatabaseConnected();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", databaseConnected ? "UP" : "DOWN");
        body.put("databaseConnected", databaseConnected);
        body.put("examMode", examMode);
        body.put("activeExam", null);
        body.put("examStatus", null);
        if (databaseConnected) {
            OfflineExam active = offlineExamRepository.findFirstByStatus(com.quiz_app.backend.entity.OfflineExamStatus.RUNNING).orElse(null);
            if (active != null) {
                body.put("activeExam", active.getQuiz().getQuizCode());
                body.put("examStatus", active.getStatus().name());
            }
        }
        return ResponseEntity.status(databaseConnected ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @GetMapping("/")
    public ResponseEntity<Map<String, String>> home() {
        return ResponseEntity.ok(Map.of("message", "Backend started successfully"));
    }

    private boolean isDatabaseConnected() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2);
        } catch (Exception e) {
            return false;
        }
    }
}
