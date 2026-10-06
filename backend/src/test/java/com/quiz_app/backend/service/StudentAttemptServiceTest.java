                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(1000L, 1L));
        }

        @Test
        void getAttemptResult_shouldRejectUnpublishedResults() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                quiz.setResultsPublished(false);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResult(1000L, 1L));
        }

        // =========================================================
        // RESULT DETAILS
        // =========================================================

        @Test
        void getAttemptResultDetails_shouldReturnQuestionWiseResults() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                attempt.setFinalScore(BigDecimal.TEN);

                StudentAnswer answer = new StudentAnswer();

                setStudentAnswerId(answer, 500L);
                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setAnswerStatus(AnswerStatus.ANSWERED);
                answer.setCorrect(true);
                answer.setMarksAwarded(BigDecimal.TEN);
                answer.setResponseTimeSeconds(15);

                StudentSelectedOption selected = mock(StudentSelectedOption.class);

                when(selected.getOption())
                                .thenReturn(option1);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of(answer));

                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));

                when(studentSelectedOptionRepository.findByAnswerId(500L))
                                .thenReturn(List.of(selected));

                List<AttemptResultDetailResponse> result = attemptService.getAttemptResultDetails(
                                1000L,
                                1L);

                assertNotNull(result);
                assertEquals(1, result.size());

                AttemptResultDetailResponse detail = result.get(0);

                assertEquals(100L, detail.questionId());
                assertEquals("What is Java?", detail.questionText());
                assertEquals(1, detail.displayOrder());
                assertEquals(List.of(101L), detail.selectedOptionIds());
                assertEquals(List.of(101L), detail.correctOptionIds());
                assertEquals(List.of("Programming language"), detail.selectedOptionTexts());
                assertEquals(List.of("Programming language"), detail.correctOptionTexts());
                assertEquals(AnswerStatus.ANSWERED, detail.answerStatus());
                assertTrue(detail.correct());
                assertEquals(BigDecimal.TEN, detail.marksAwarded());
                assertEquals(BigDecimal.TEN, detail.questionMarks());
                assertEquals(15, detail.responseTimeSeconds());
        }

        @Test
        void getAttemptResultDetails_shouldReturnAllOptionTextsForMsq() {

                question.setQuestionType(QuestionType.MSQ);

                option2.setCorrect(true);

                StudentAnswer answer = new StudentAnswer();
                setStudentAnswerId(answer, 501L);
                answer.setAttempt(attempt);
                answer.setQuestion(question);
                answer.setAnswerStatus(AnswerStatus.ANSWERED);
                answer.setCorrect(true);
                answer.setMarksAwarded(BigDecimal.TEN);
                answer.setResponseTimeSeconds(20);

                StudentSelectedOption selected1 = mock(StudentSelectedOption.class);
                StudentSelectedOption selected2 = mock(StudentSelectedOption.class);
                when(selected1.getOption()).thenReturn(option1);
                when(selected2.getOption()).thenReturn(option2);

                attempt.setStatus(AttemptStatus.SUBMITTED);

                when(quizAttemptRepository.findById(1000L)).thenReturn(Optional.of(attempt));
                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));
                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of(answer));
                when(optionRepository.findByQuestionIdOrderByOptionOrder(100L))
                                .thenReturn(List.of(option1, option2));
                when(studentSelectedOptionRepository.findByAnswerId(501L))
                                .thenReturn(List.of(selected1, selected2));

                List<AttemptResultDetailResponse> result =
                                attemptService.getAttemptResultDetails(1000L, 1L);

                AttemptResultDetailResponse detail = result.get(0);

                assertEquals(List.of(101L, 102L), detail.selectedOptionIds());
                assertEquals(List.of(101L, 102L), detail.correctOptionIds());
                assertEquals(
                                List.of("Programming language", "Database"),
                                detail.selectedOptionTexts());
                assertEquals(
                                List.of("Programming language", "Database"),
                                detail.correctOptionTexts());
        }

        @Test
        void getAttemptResultDetails_shouldRejectWrongStudent() {

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResultDetails(1000L, 999L));
        }

        @Test
        void getAttemptResultDetails_shouldRejectWhenQuestionWiseResultsUnavailable() {

                attempt.setStatus(AttemptStatus.SUBMITTED);
                quiz.setResultVisibility(ResultVisibility.LEADERBOARD);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                assertThrows(
                                BadRequestException.class,
                                () -> attemptService.getAttemptResultDetails(
                                                1000L,
                                                1L));
        }

        @Test
        void getAttemptResultDetails_shouldCreateUnansweredDetailWhenAnswerMissing() {

                attempt.setStatus(AttemptStatus.SUBMITTED);

                when(quizAttemptRepository.findById(1000L))
                                .thenReturn(Optional.of(attempt));

                when(questionRepository.findByQuizIdOrderByDisplayOrder(10L))
                                .thenReturn(List.of(question));

                when(studentAnswerRepository.findByAttemptId(1000L))
                                .thenReturn(List.of());
