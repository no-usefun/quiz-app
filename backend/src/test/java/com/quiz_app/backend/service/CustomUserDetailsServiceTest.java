package com.quiz_app.backend.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.repository.UserRepository;
import com.quiz_app.backend.security.CustomUserDetails;

@ExtendWith(MockitoExtension.class)
class CustomUserDetailsServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void loadUserById_shouldReturnCustomUserDetails() {
        User user = user("alex@example.com", "STUDENT");

        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        var result = service.loadUserById(1L);

        assertEquals("alex@example.com", result.getUsername());
        assertEquals(1L, ((CustomUserDetails) result).getId());
    }

    @Test
    void loadUserById_shouldThrowWhenMissing() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        assertThrows(
                UsernameNotFoundException.class,
                () -> service.loadUserById(99L));
    }

    @Test
    void loadUserByUsername_shouldReturnUser() {
        User user = user("alex@example.com", "TEACHER");

        when(userRepository.findByEmail("alex@example.com")).thenReturn(Optional.of(user));

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        var result = service.loadUserByUsername("alex@example.com");

        assertEquals("alex@example.com", result.getUsername());
        assertEquals("ROLE_TEACHER",
                result.getAuthorities().iterator().next().getAuthority());
    }

    @Test
    void loadUserByUsername_shouldThrowWhenMissing() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        CustomUserDetailsService service = new CustomUserDetailsService(userRepository);

        assertThrows(
                UsernameNotFoundException.class,
                () -> service.loadUserByUsername("missing@example.com"));
    }

    private User user(String email, String roleName) {
        User user = new User();
        try {
            var field = User.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, 1L);
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
        user.setEmail(email);
        Role role = new Role();
        role.setName(roleName);
        user.setRole(role);
        user.setActive(true);
        return user;
    }
}
