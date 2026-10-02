package com.quiz_app.backend.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;

class CustomUserDetailsTest {

    @Test
    void constructor_shouldFailClosedWhenRoleIsMissing() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setActive(true);
        user.setRole(null);

        assertThrows(IllegalStateException.class, () -> new CustomUserDetails(user));
    }

    @Test
    void constructor_shouldNormalizeValidRole() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setActive(true);

        Role role = new Role();
        role.setName("student");
        user.setRole(role);

        CustomUserDetails details = new CustomUserDetails(user);

        assertEquals(
                new SimpleGrantedAuthority("ROLE_STUDENT"),
                details.getAuthorities().iterator().next());
    }
}
