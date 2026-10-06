                                        .divide(totalMarks, 2, java.math.RoundingMode.HALF_UP);
                }

                return new AttemptResultResponse(
                                attempt.getId(),
                                quiz.getId(),
                                quiz.getTitle(),
                                attempt.getStudent().getId(),
                                attempt.getStatus(),
                                attempt.getFinalScore(),
                                totalMarks,
                                percentage,
                                attempt.getTotalTimeTaken(),
                                attempt.getStartedAt(),
                                attempt.getSubmittedAt());
        }

        public List<AttemptResultDetailResponse> getAttemptResultDetails(
                        Long attemptId,
                        Long studentId) {

                if (attemptId == null) {
                        throw new BadRequestException("ATTEMPT_ID_REQUIRED",
                                        "Attempt ID is required");
                }

                QuizAttempt attempt = quizAttemptRepository.findById(attemptId)
                                .orElseThrow(() -> {
                                        throw new AccessDeniedApplicationException(
                                                        "ATTEMPT_NOT_OWNED",
                                                        "You are not authorized to view this result");
                                });

                if (attempt.getStudent() == null ||
                                !attempt.getStudent().getId().equals(studentId)) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_OWNED",
                                        "You are not authorized to view this result");
                }

                Quiz quiz = attempt.getQuiz();

                if (attempt.getStatus() != AttemptStatus.SUBMITTED
                                && attempt.getStatus() != AttemptStatus.AUTO_SUBMITTED) {

                        throw new BadRequestException(
                                        "ATTEMPT_NOT_SUBMITTED",
                                        "Result is available only after submission");
                }

                if (!quiz.isResultsPublished()) {
                        throw new BadRequestException("RESULTS_NOT_PUBLISHED",
                                        "Results have not been published yet");
                }

                if (quiz.getResultVisibility() != ResultVisibility.QUESTION_WISE
                                && quiz.getResultVisibility() != ResultVisibility.BOTH) {

                        throw new BadRequestException(
                                        "RESULT_DETAILS_NOT_AVAILABLE",
                                        "Question-wise results are not available");
                }

                List<Question> questions = questionRepository.findByQuizIdOrderByDisplayOrder(
                                attempt.getQuiz().getId());

                List<StudentAnswer> answers = studentAnswerRepository.findByAttemptId(attemptId);

                java.util.Map<Long, StudentAnswer> answerMap = new java.util.HashMap<>();

                for (StudentAnswer answer : answers) {
                        answerMap.put(
                                        answer.getQuestion().getId(),
                                        answer);
                }

                List<AttemptResultDetailResponse> result = new java.util.ArrayList<>();

                for (Question question : questions) {

                        StudentAnswer answer = answerMap.get(question.getId());

                        List<Option> questionOptions =
                                        optionRepository.findByQuestionIdOrderByOptionOrder(question.getId());

                        // Resolve option IDs and texts from persisted option data. This keeps
                        // historical results independent of the active quiz package.
                        List<Long> correctOptionIds = questionOptions.stream()
                                        .filter(Option::isCorrect)
                                        .map(Option::getId)
                                        .toList();

                        List<String> correctOptionTexts = questionOptions.stream()
                                        .filter(Option::isCorrect)
                                        .map(Option::getOptionText)
                                        .toList();

                        List<Long> selectedOptionIds = new java.util.ArrayList<>();
                        List<String> selectedOptionTexts = new java.util.ArrayList<>();

                        AnswerStatus answerStatus;
                        boolean correct = false;
                        BigDecimal marksAwarded = BigDecimal.ZERO;
                        Integer responseTimeSeconds = null;

                        if (answer == null) {

                                answerStatus = AnswerStatus.UNANSWERED;

                        } else {

                                answerStatus = answer.getAnswerStatus();
                                correct = answer.isCorrect();
                                marksAwarded = answer.getMarksAwarded();
                                responseTimeSeconds = answer.getResponseTimeSeconds();

                                List<StudentSelectedOption> selectedOptions = studentSelectedOptionRepository
                                                .findByAnswerId(answer.getId());

                                selectedOptionIds = selectedOptions.stream()
                                                .map(selected -> selected.getOption().getId())
                                                .toList();

                                selectedOptionTexts = selectedOptions.stream()
                                                .map(selected -> selected.getOption().getOptionText())
                                                .toList();
                        }

                        result.add(
                                        new AttemptResultDetailResponse(
                                                        question.getId(),
                                                        question.getQuestionText(),
                                                        question.getExplanation(),
                                                        question.getDisplayOrder(),
                                                        selectedOptionIds,
                                                        correctOptionIds,
                                                        selectedOptionTexts,
                                                        correctOptionTexts,
                                                        answerStatus,
                                                        correct,
                                                        marksAwarded,
                                                        question.getMarks(),
                                                        responseTimeSeconds));
                }

                return result;
        }

        public List<LeaderboardEntryResponse> getLeaderboard(Long quizId, Long studentId) {
