package com.quiz_app.backend.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.quiz_app.backend.security.CustomUserDetails;
import com.quiz_app.backend.service.ProctoringService;
import com.quiz_app.backend.service.StudentAttemptService;

@ExtendWith(MockitoExtension.class)
class TeacherProctoringControllerTest {

    @Mock
    private ProctoringService proctoringService;

    @Mock
    private StudentAttemptService studentAttemptService;

    @Mock
    private Authentication authentication;

    @Mock
    private CustomUserDetails userDetails;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders
                .standaloneSetup(new TeacherProctoringController(proctoringService, studentAttemptService))
                .build();
        when(authentication.getPrincipal()).thenReturn(userDetails);
        when(userDetails.getId()).thenReturn(77L);
    }

    @Test
    void rePermit_shouldPassAttemptIdAndAuthenticatedTeacherId() throws Exception {
        mockMvc.perform(put("/api/v1/teacher/proctoring/attempts/9001/repermit")
                .principal(authentication))
                .andExpect(status().isOk());

        verify(studentAttemptService).rePermitAttempt(9001L, 77L);
    }
}
