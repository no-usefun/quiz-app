package com.quiz_app.backend.service;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;

import com.quiz_app.backend.dto.user.CreateStudentRequest;
import com.quiz_app.backend.dto.user.CreateTeacherRequest;
import com.quiz_app.backend.dto.user.UserResponse;
import com.quiz_app.backend.entity.Role;
import com.quiz_app.backend.entity.User;
import com.quiz_app.backend.exception.BadRequestException;
import com.quiz_app.backend.exception.ConflictException;
import com.quiz_app.backend.exception.ResourceNotFoundException;
import com.quiz_app.backend.repository.RoleRepository;
import com.quiz_app.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RoleRepository roleRepository;

    private UserService userService;

    private Role teacherRole;
    private Role studentRole;

    @BeforeEach
    void setUp() {

        userService = new UserService(
                userRepository,
                roleRepository);

        teacherRole = new Role();
        teacherRole.setName("TEACHER");

        studentRole = new Role();
        studentRole.setName("STUDENT");
    }

    // =========================================================
    // CREATE TEACHER - SUCCESS
    // =========================================================

    @Test
    void createTeacher_shouldCreateSuccessfully() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        when(userRepository.existsByEmail(
                "jane@university.edu"))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(
                "REG-T-001"))
                .thenReturn(false);

        when(roleRepository.findByName("TEACHER"))
                .thenReturn(Optional.of(teacherRole));

        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.createTeacher(request);

        assertNotNull(response);
        assertEquals("Jane", response.firstName());
        assertEquals("Smith", response.lastName());
        assertEquals(
                "jane@university.edu",
                response.email());
        assertEquals(
                "REG-T-001",
                response.registrationNo());
        assertEquals("TEACHER", response.role());

        verify(userRepository)
                .save(any(User.class));
    }

    // =========================================================
    // CREATE TEACHER - ENTITY MAPPING
    // =========================================================

    @Test
    void createTeacher_shouldPopulateUserCorrectly() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        when(userRepository.existsByEmail(any()))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(any()))
                .thenReturn(false);

        when(roleRepository.findByName("TEACHER"))
                .thenReturn(Optional.of(teacherRole));

        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        userService.createTeacher(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);

        verify(userRepository)
                .save(captor.capture());

        User teacher = captor.getValue();

        assertEquals("Jane", teacher.getFirstName());
        assertEquals("Smith", teacher.getLastName());
        assertEquals(
                "jane@university.edu",
                teacher.getEmail());
        assertEquals(
                "password123",
                teacher.getPasswordHash());
        assertEquals(
                "REG-T-001",
                teacher.getRegistrationNo());
        assertEquals(
                teacherRole,
                teacher.getRole());
        assertEquals(
                "LOCAL",
                teacher.getAuthProvider());
        assertEquals(true, teacher.isVerified());
        assertEquals(true, teacher.isActive());
        assertNotNull(teacher.getCreatedAt());
        assertNotNull(teacher.getUpdatedAt());
    }

    // =========================================================
    // CREATE TEACHER - VALIDATION
    // =========================================================

    @Test
    void createTeacher_shouldRejectMissingFirstName() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                null,
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));

        verify(userRepository, never())
                .save(any(User.class));
    }

    @Test
    void createTeacher_shouldRejectBlankFirstName() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "   ",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectMissingLastName() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                null,
                "jane@university.edu",
                "password123",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectMissingEmail() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                null,
                "password123",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectBlankEmail() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "   ",
                "password123",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectMissingRegistrationNumber() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                null);

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectBlankRegistrationNumber() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "   ");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectMissingPassword() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                null,
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    @Test
    void createTeacher_shouldRejectBlankPassword() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "   ",
                "REG-T-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createTeacher(request));
    }

    // =========================================================
    // CREATE TEACHER - DUPLICATES
    // =========================================================

    @Test
    void createTeacher_shouldRejectDuplicateEmail() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        when(userRepository.existsByEmail(
                "jane@university.edu"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> userService.createTeacher(request));

        verify(roleRepository, never())
                .findByName(any());

        verify(userRepository, never())
                .save(any(User.class));
    }

    @Test
    void createTeacher_shouldRejectDuplicateRegistrationNumber() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        when(userRepository.existsByEmail(
                "jane@university.edu"))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(
                "REG-T-001"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> userService.createTeacher(request));

        verify(roleRepository, never())
                .findByName(any());

        verify(userRepository, never())
                .save(any(User.class));
    }

    // =========================================================
    // CREATE TEACHER - ROLE
    // =========================================================

    @Test
    void createTeacher_shouldRejectWhenTeacherRoleMissing() {

        CreateTeacherRequest request = new CreateTeacherRequest(
                "Jane",
                "Smith",
                "jane@university.edu",
                "password123",
                "REG-T-001");

        when(userRepository.existsByEmail(any()))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(any()))
                .thenReturn(false);

        when(roleRepository.findByName("TEACHER"))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> userService.createTeacher(request));

        verify(userRepository, never())
                .save(any(User.class));
    }

    // =========================================================
    // CREATE STUDENT - SUCCESS
    // =========================================================

    @Test
    void createStudent_shouldCreateSuccessfully() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        when(userRepository.existsByEmail(
                "alex@university.edu"))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(
                "REG-S-001"))
                .thenReturn(false);

        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(studentRole));

        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        UserResponse response = userService.createStudent(request);

        assertNotNull(response);
        assertEquals("Alex", response.firstName());
        assertEquals("Carter", response.lastName());
        assertEquals(
                "alex@university.edu",
                response.email());
        assertEquals(
                "REG-S-001",
                response.registrationNo());
        assertEquals("STUDENT", response.role());

        verify(userRepository)
                .save(any(User.class));
    }

    // =========================================================
    // CREATE STUDENT - ENTITY MAPPING
    // =========================================================

    @Test
    void createStudent_shouldPopulateUserCorrectly() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        when(userRepository.existsByEmail(any()))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(any()))
                .thenReturn(false);

        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.of(studentRole));

        when(userRepository.save(any(User.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        userService.createStudent(request);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);

        verify(userRepository)
                .save(captor.capture());

        User student = captor.getValue();

        assertEquals("Alex", student.getFirstName());
        assertEquals("Carter", student.getLastName());
        assertEquals(
                "alex@university.edu",
                student.getEmail());
        assertEquals(
                "REG-S-001",
                student.getRegistrationNo());
        assertEquals(
                studentRole,
                student.getRole());
        assertEquals(
                "LOCAL",
                student.getAuthProvider());
        assertEquals(true, student.isVerified());
        assertEquals(true, student.isActive());
        assertNotNull(student.getCreatedAt());
        assertNotNull(student.getUpdatedAt());
    }

    // =========================================================
    // CREATE STUDENT - VALIDATION
    // =========================================================

    @Test
    void createStudent_shouldRejectMissingFirstName() {

        CreateStudentRequest request = new CreateStudentRequest(
                null,
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));

        verify(userRepository, never())
                .save(any(User.class));
    }

    @Test
    void createStudent_shouldRejectMissingLastName() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                null,
                "alex@university.edu",
                "REG-S-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));
    }

    @Test
    void createStudent_shouldRejectMissingEmail() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                null,
                "REG-S-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));
    }

    @Test
    void createStudent_shouldRejectBlankEmail() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "   ",
                "REG-S-001");

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));
    }

    @Test
    void createStudent_shouldRejectMissingRegistrationNumber() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                null);

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));
    }

    @Test
    void createStudent_shouldRejectBlankRegistrationNumber() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "   ");

        assertThrows(
                BadRequestException.class,
                () -> userService.createStudent(request));
    }

    // =========================================================
    // CREATE STUDENT - DUPLICATES
    // =========================================================

    @Test
    void createStudent_shouldRejectDuplicateEmail() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        when(userRepository.existsByEmail(
                "alex@university.edu"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> userService.createStudent(request));

        verify(roleRepository, never())
                .findByName(any());

        verify(userRepository, never())
                .save(any(User.class));
    }

    @Test
    void createStudent_shouldRejectDuplicateRegistrationNumber() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        when(userRepository.existsByEmail(
                "alex@university.edu"))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(
                "REG-S-001"))
                .thenReturn(true);

        assertThrows(
                ConflictException.class,
                () -> userService.createStudent(request));

        verify(roleRepository, never())
                .findByName(any());

        verify(userRepository, never())
                .save(any(User.class));
    }

    // =========================================================
    // CREATE STUDENT - ROLE
    // =========================================================

    @Test
    void createStudent_shouldRejectWhenStudentRoleMissing() {

        CreateStudentRequest request = new CreateStudentRequest(
                "Alex",
                "Carter",
                "alex@university.edu",
                "REG-S-001");

        when(userRepository.existsByEmail(any()))
                .thenReturn(false);

        when(userRepository.existsByRegistrationNo(any()))
                .thenReturn(false);

        when(roleRepository.findByName("STUDENT"))
                .thenReturn(Optional.empty());

        assertThrows(
                ResourceNotFoundException.class,
                () -> userService.createStudent(request));

        verify(userRepository, never())
                .save(any(User.class));
    }
}