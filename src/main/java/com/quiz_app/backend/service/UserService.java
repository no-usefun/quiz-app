package com.quiz_app.backend.service;

import com.quiz_app.backend.dto.user.CreateStudentRequest;
import com.quiz_app.backend.dto.user.CreateTeacherRequest;
import com.quiz_app.backend.dto.user.UserResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    public UserService(
            UserRepository userRepository,
            RoleRepository roleRepository) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
    }

    @Transactional
    public UserResponse createTeacher(
            CreateTeacherRequest request) {

        validateCommonUserData(
                request.firstName(),
                request.lastName(),
                request.email(),
                request.registrationNo());

        if (request.password() == null ||
                request.password().isBlank()) {

            throw new IllegalArgumentException(
                    "Password is required");
        }

        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException(
                    "Email is already registered");
        }

        if (request.registrationNo() != null &&
                userRepository.existsByRegistrationNo(
                        request.registrationNo())) {

            throw new IllegalArgumentException(
                    "Registration number is already registered");
        }

        Role teacherRole = roleRepository
                .findByRoleName("TEACHER")
                .orElseThrow(() -> new IllegalStateException(
                        "TEACHER role not found"));

        User teacher = new User();

        teacher.setFirstName(request.firstName());
        teacher.setLastName(request.lastName());
        teacher.setEmail(request.email());
        teacher.setRegistrationNo(
                request.registrationNo());

        /*
         * Temporary development implementation.
         *
         * DO NOT store plain passwords in production.
         * We'll replace this with PasswordEncoder
         * when authentication is implemented.
         */
        teacher.setPasswordHash(request.password());

        teacher.setRole(teacherRole);
        teacher.setAuthProvider("LOCAL");
        teacher.setVerified(true);
        teacher.setActive(true);

        teacher.setCreatedAt(
                java.time.LocalDateTime.now());
        teacher.setUpdatedAt(
                java.time.LocalDateTime.now());

        teacher = userRepository.save(teacher);

        return toResponse(teacher);
    }

    @Transactional
    public UserResponse createStudent(
            CreateStudentRequest request) {

        validateCommonUserData(
                request.firstName(),
                request.lastName(),
                request.email(),
                request.registrationNo());

        if (userRepository.existsByEmail(request.email())) {
            throw new IllegalArgumentException(
                    "Email is already registered");
        }

        if (request.registrationNo() != null &&
                userRepository.existsByRegistrationNo(
                        request.registrationNo())) {

            throw new IllegalArgumentException(
                    "Registration number is already registered");
        }

        Role studentRole = roleRepository
                .findByRoleName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "STUDENT role not found"));

        User student = new User();

        student.setFirstName(request.firstName());
        student.setLastName(request.lastName());
        student.setEmail(request.email());
        student.setRegistrationNo(
                request.registrationNo());

        student.setRole(studentRole);
        student.setAuthProvider("LOCAL");
        student.setVerified(true);
        student.setActive(true);

        student.setCreatedAt(
                java.time.LocalDateTime.now());
        student.setUpdatedAt(
                java.time.LocalDateTime.now());

        student = userRepository.save(student);

        return toResponse(student);
    }

    private void validateCommonUserData(
            String firstName,
            String lastName,
            String email,
            String registrationNo) {

        if (firstName == null || firstName.isBlank()) {
            throw new IllegalArgumentException(
                    "First name is required");
        }

        if (lastName == null || lastName.isBlank()) {
            throw new IllegalArgumentException(
                    "Last name is required");
        }

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException(
                    "Email is required");
        }

        if (registrationNo == null ||
                registrationNo.isBlank()) {

            throw new IllegalArgumentException(
                    "Registration number is required");
        }
    }

    private UserResponse toResponse(User user) {

        return new UserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getRegistrationNo(),
                user.getRole().getRoleName());
    }
}