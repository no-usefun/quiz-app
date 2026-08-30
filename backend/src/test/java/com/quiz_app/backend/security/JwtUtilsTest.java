package com.quiz_app.backend.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.entity.Role;

class JwtUtilsTest {

    private JwtUtils jwtUtils;

    @BeforeEach
    void setUp() throws Exception {
        jwtUtils = new JwtUtils();
        setPrivateField(jwtUtils, "jwtSecret", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970");
        setPrivateField(jwtUtils, "jwtExpirationMs", 3600000L);
    }

    private void setPrivateField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    @Test
    void testGenerateAndValidateToken() {
        Role role = new Role();
        role.setName("TEACHER");

        User user = new User();
        user.setFirstName("Jane");
        user.setLastName("Doe");
        user.setEmail("jane.doe@university.edu");
        user.setRole(role);
        user.setAuthProvider("LOCAL");

        String token = jwtUtils.generateToken(user);
        assertNotNull(token);
        assertTrue(jwtUtils.validateToken(token));
        assertEquals("jane.doe@university.edu", jwtUtils.getEmailFromToken(token));
        assertEquals("TEACHER", jwtUtils.getRoleFromToken(token));
    }

    @Test
    void testInvalidToken() {
        assertFalse(jwtUtils.validateToken("invalid.token.here"));
    }
}
