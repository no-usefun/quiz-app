package com.quiz_app.backend.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class HealthControllerTest {

    private final HealthController controller = new HealthController();

    @Test
    void health_shouldReturnUp() {
        var response = controller.health();

        assertEquals(200, response.getStatusCode().value());
        assertEquals("UP", response.getBody().get("status"));
    }

    @Test
    void home_shouldReturnStartupMessage() {
        var response = controller.home();

        assertEquals(200, response.getStatusCode().value());
        assertEquals(
                "Backend started successfully",
                response.getBody().get("message"));
    }
}
