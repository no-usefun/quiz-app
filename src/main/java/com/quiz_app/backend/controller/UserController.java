package com.quiz_app.backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.quiz_app.backend.dto.user.CreateStudentRequest;
import com.quiz_app.backend.dto.user.CreateTeacherRequest;
import com.quiz_app.backend.dto.user.UserResponse;
import com.quiz_app.backend.service.UserService;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/teachers")
    public ResponseEntity<UserResponse> createTeacher(
            @RequestBody CreateTeacherRequest request) {

        UserResponse response = userService.createTeacher(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @PostMapping("/students")
    public ResponseEntity<UserResponse> createStudent(
            @RequestBody CreateStudentRequest request) {

        UserResponse response = userService.createStudent(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}