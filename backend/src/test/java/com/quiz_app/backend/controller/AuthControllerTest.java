                                .setPassword(
                                                userDetails,
                                                new com.quiz_app.backend.dto.auth.SetPasswordRequest("password123"));

                assertEquals(200, response.getStatusCode().value());
                verify(authService).setPassword(
                                "jane@example.com",
                                new com.quiz_app.backend.dto.auth.SetPasswordRequest("password123"));
        }

        @Test
        void updateProfile_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                var request = new com.quiz_app.backend.dto.auth.UpdateProfileRequest(
                                "Jane", "Smith", null, null, null, null, null);
                when(authService.updateProfile("jane@example.com", request)).thenReturn(summary);

                var response = new AuthController(authService, emailVerificationService)
                                .updateProfile(userDetails, request);

                assertEquals(200, response.getStatusCode().value());
                assertEquals(summary, response.getBody());
                verify(authService).updateProfile("jane@example.com", request);
        }

        @Test
        void updateProfile_shouldRejectMissingPrincipal() {
                assertThrowsBadRequest(() -> new AuthController(authService, emailVerificationService)
                                .updateProfile(null,
                                                new com.quiz_app.backend.dto.auth.UpdateProfileRequest(
                                                                "Jane", null, null, null, null, null, null)));
        }

        @Test
        void changePassword_shouldDelegate() {
                when(userDetails.getUsername()).thenReturn("jane@example.com");
                var request = new com.quiz_app.backend.dto.auth.ChangePasswordRequest(
                                "old-password", "new-password");

                var response = new AuthController(authService, emailVerificationService)
                                .changePassword(userDetails, request);