package com.quiz_app.backend.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import org.junit.jupiter.api.Test;

class ConsoleEmailServiceTest {

    @Test
    void sendVerificationEmail_shouldCompleteWithoutThrowing() {
        ConsoleEmailService service = new ConsoleEmailService();

        assertDoesNotThrow(() -> service.sendVerificationEmail(
                "user@example.com",
                "verification-token"));
    }
}
