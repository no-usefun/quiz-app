package com.quiz_app.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

import java.sql.Connection;

import javax.sql.DataSource;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.quiz_app.backend.repository.OfflineExamRepository;

class HealthControllerTest {
    private DataSource dataSource;
    private OfflineExamRepository offlineExamRepository;
    private Connection connection;
    private HealthController controller;

    @BeforeEach
    void setUp() throws Exception {
        dataSource = mock(DataSource.class);
        offlineExamRepository = mock(OfflineExamRepository.class);
        connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);
        when(offlineExamRepository.findFirstByStatus(any())).thenReturn(java.util.Optional.empty());
        controller = new HealthController(dataSource, offlineExamRepository, "LOCAL_EXAM");
    }

    @Test
    void health_shouldReportDatabaseAndExamMode() {
        var response = controller.health();
        assertEquals(200, response.getStatusCode().value());
        assertEquals("UP", response.getBody().get("status"));
        assertEquals(true, response.getBody().get("databaseConnected"));
        assertEquals("LOCAL_EXAM", response.getBody().get("examMode"));
    }

    @Test
    void home_shouldReturnStartupMessage() {
        var response = controller.home();
        assertEquals(200, response.getStatusCode().value());
        assertEquals("Backend started successfully", response.getBody().get("message"));
    }
}
