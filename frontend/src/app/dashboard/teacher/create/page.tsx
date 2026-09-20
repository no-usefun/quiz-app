"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import {
  ArrowLeft,
  Upload,
  FileType,
  Clock,
  ChevronDown,
  Trash2,
  PlusCircle,
  Lock,
  Check,
  AlertCircle,
  FileQuestion,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { resolveQuizIdentifiers, getCachedQuizzes } from "@/lib/quizCache";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function CreateAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams?.get("draftId") || null;
  const { user } = useSession();
  const [mounted, setMounted] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [publishRetryData, setPublishRetryData] = useState<{
    quizId: number;
    quizCode: string;
  } | null>(null);
  const [retryingPublish, setRetryingPublish] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState(
    "Read all questions carefully before submitting.",
  );
  const [subject, setSubject] = useState("Computer Science");
  const [subjectCode, setSubjectCode] = useState("CS-201");
  const [allowedRollsText, setAllowedRollsText] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const setOverallTimerSeconds = (secs: number) => {
    if (secs > 0) {
      setTimeLimit(Math.max(1, Math.round(secs / 60)));
    }
  };

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [publishScoresImmediately, setPublishScoresImmediately] =
    useState(false);
  const [revealSolutions, setRevealSolutions] = useState(false);
  const [acceptedDomain, setAcceptedDomain] = useState("");

  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);

  // ── State Hydration helper for editing drafts ─────────────────────────────
  const hydrateFromQuizData = (data: any, questionsOverride?: any[]) => {
    if (!data) return;

    // Support nested or wrapped responses: data.data, data.quizPackage, etc.
    const root =
      data.data && typeof data.data === "object" && !Array.isArray(data.data)
        ? { ...data, ...data.data }
        : data;

    if (root.title || root.quizName || root.quizTitle) {
      setTitle(root.title || root.quizName || root.quizTitle);
    }
    if (root.description) {
      setDescription(root.description);
    }
    if (root.instructions) {
      setInstructions(root.instructions);
    }
    if (root.subject || root.subjectName) {
      setSubject(root.subject || root.subjectName);
    }
    if (root.subjectCode) {
      setSubjectCode(root.subjectCode);
    }

    if (root.overallTimerSeconds || root.settings?.overallTimerSeconds) {
      const timerSecs =
        root.overallTimerSeconds ?? root.settings?.overallTimerSeconds ?? 1800;
      setTimeLimit(Math.max(1, Math.round(timerSecs / 60)));
    }

    if (Array.isArray(root.allowedRolls)) {
      setAllowedRollsText(root.allowedRolls.join(", "));
    } else if (Array.isArray(root.allowedRegistrationNumbers)) {
      setAllowedRollsText(root.allowedRegistrationNumbers.join(", "));
    } else if (typeof root.allowedRolls === "string") {
      setAllowedRollsText(root.allowedRolls);
    }

    const neg = Boolean(
      root.negativeMarking ?? root.settings?.negativeMarking ?? false,
    );
    setNegativeMarking(neg);
    const negMarks = Number(
      root.negativeMarks ?? root.settings?.negativeMarks ?? 0.25,
    );
    setNegativeMarks(negMarks);

    const vis = root.resultVisibility ?? root.settings?.resultVisibility;
    if (vis === "BOTH") {
      setPublishScoresImmediately(true);
      setRevealSolutions(true);
      setShowAdvanced(true);
    } else if (vis === "LEADERBOARD") {
      setPublishScoresImmediately(true);
      setRevealSolutions(false);
      setShowAdvanced(true);
    } else if (vis === "QUESTION_WISE") {
      setPublishScoresImmediately(false);
      setRevealSolutions(true);
      setShowAdvanced(true);
    } else if (vis === "NONE") {
      setPublishScoresImmediately(false);
      setRevealSolutions(false);
    }
    if (root.acceptedEmailDomain !== undefined) {
      setAcceptedDomain(root.acceptedEmailDomain || "");
    } else if (root.acceptedDomain !== undefined) {
      setAcceptedDomain(root.acceptedDomain || "");
    }
    if (neg || root.acceptedEmailDomain || root.acceptedDomain)
      setShowAdvanced(true);

    const findQuestions = (obj: any): any[] => {
      if (!obj || typeof obj !== "object") return [];
      const candidates = [
        obj.questions,
        obj.quizPackage?.questions,
        obj.package?.questions,
        obj.questionList,
        obj.data?.questions,
        obj.data?.quizPackage?.questions,
        obj.data?.package?.questions,
        obj.data?.questionList,
      ];
      for (const c of candidates) {
        if (Array.isArray(c) && c.length > 0) return c;
      }
      return [];
    };

    const rawQuestions =
      Array.isArray(questionsOverride) && questionsOverride.length > 0
        ? questionsOverride
        : findQuestions(root).length > 0
          ? findQuestions(root)
          : findQuestions(data);

    if (rawQuestions.length > 0) {
      const mappedQuestions = rawQuestions.map((q: any, i: number) => ({
        // Preserve IDs so PUT /settings sends them back to the backend
        questionId: q.questionId ?? q.id ?? null,
        questionText: String(q.questionText || q.text || q.prompt || ""),
        imageUrl: q.imageUrl || "",
        explanation: q.explanation || "",
        // Backend package returns "MCQ"; UI expects "MULTIPLE_CHOICE"
        questionType:
          q.questionType === "MCQ"
            ? "MULTIPLE_CHOICE"
            : q.questionType || "MULTIPLE_CHOICE",
        marks: Number(q.marks || 1),
        negativeMarks: Number(q.negativeMarks || 0),
        questionTimerSeconds: Number(q.questionTimerSeconds || 60),
        difficulty: q.difficulty || "MEDIUM",
        displayOrder: q.displayOrder || i + 1,
        options: (q.options || []).map((opt: any, oi: number) => ({
          optionId: opt.optionId ?? opt.id ?? null,
          optionText: String(opt.optionText || opt.text || ""),
          optionImage: opt.optionImage || "",
          // Backend package uses optionOrder; UI uses displayOrder
          displayOrder: opt.optionOrder || opt.displayOrder || oi + 1,
          // /package strips isCorrect (student-facing); prefer cached value,
          // default to false so the UI doesn't crash — teacher re-checks answers
          isCorrect: Boolean(opt.isCorrect === true || opt.correct === true),
        })),
      }));
      console.log("[Quiz Edit] Raw questions:", rawQuestions);
      console.log("[Quiz Edit] Mapped questions:", mappedQuestions);
      setParsedQuestions(mappedQuestions);
    }
  };

  // ── Retrieve and Hydrate Draft Assessment on Mount ────────────────────────
  useEffect(() => {
    if (!draftId) return;

    let isMounted = true;

    // Check localStorage immediately on mount to populate all metadata and settings
    const cachedDraft =
      typeof window !== "undefined"
        ? localStorage.getItem(`quiz_draft_${draftId}`)
        : null;
    if (cachedDraft) {
      try {
        const parsed = JSON.parse(cachedDraft);
        if (parsed && typeof parsed === "object") {
          setTitle(parsed.title || "");
          setSubject(parsed.subject || "");
          setSubjectCode(parsed.subjectCode || "");
          setDescription(parsed.description || "");
          setInstructions(parsed.instructions || "");
          setOverallTimerSeconds(parsed.overallTimerSeconds || 0);
          setAcceptedDomain(
            parsed.acceptedEmailDomain || parsed.acceptedDomain || "",
          );
          if (parsed.allowedRollsText) {
            setAllowedRollsText(parsed.allowedRollsText);
          } else if (Array.isArray(parsed.allowedRolls)) {
            setAllowedRollsText(parsed.allowedRolls.join(", "));
          }
          if (parsed.negativeMarking !== undefined) {
            setNegativeMarking(Boolean(parsed.negativeMarking));
          }
          if (parsed.negativeMarks !== undefined) {
            setNegativeMarks(Number(parsed.negativeMarks));
          }
          if (parsed.publishScoresImmediately !== undefined) {
            setPublishScoresImmediately(
              Boolean(parsed.publishScoresImmediately),
            );
          }
          if (parsed.revealSolutions !== undefined) {
            setRevealSolutions(Boolean(parsed.revealSolutions));
          }
          if (
            parsed.negativeMarking ||
            parsed.publishScoresImmediately ||
            parsed.revealSolutions ||
            parsed.acceptedEmailDomain ||
            parsed.acceptedDomain
          ) {
            setShowAdvanced(true);
          }
          // Fallback for questions if the API /package fetch hasn't overwritten them yet
          if (parsed.questions?.length) {
            setParsedQuestions(parsed.questions);
          }
        }
      } catch (e) {
        console.warn(
          "[DynoQuizz] Failed to parse saved draft from localStorage:",
          e,
        );
      }
    }

    const fetchDraft = async () => {
      setLoadingDraft(true);
      setValidationError(null);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("dynoquizz_token")
          : null;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      try {
        let data: any = null;

        // Helper: the /package endpoint is student-facing and strips isCorrect.
        // Whenever we have raw questions from a package fetch, immediately check
        // localStorage for a teacher-side cache that still has isCorrect intact.
        // Returns the localStorage array when found, the packageQuestions otherwise.
        const preferLocalStorageQuestions = (
          packageQuestions: any[],
        ): any[] => {
          const localRaw =
            localStorage.getItem(`draft_questions_${draftId}`) ||
            (data?.quizId
              ? localStorage.getItem(`draft_questions_${data.quizId}`)
              : null) ||
            (data?.id
              ? localStorage.getItem(`draft_questions_${data.id}`)
              : null);

          if (!localRaw) {
            return packageQuestions;
          }

          try {
            const localQuestions = JSON.parse(localRaw);

            if (!Array.isArray(localQuestions) || localQuestions.length === 0) {
              return packageQuestions;
            }

            return packageQuestions.map(
              (backendQuestion: any, questionIndex: number) => {
                const backendQId =
                  backendQuestion.questionId ?? backendQuestion.id ?? null;

                const localQuestion =
                  localQuestions.find(
                    (q: any) =>
                      backendQId != null &&
                      (q.questionId != null || q.id != null) &&
                      String(q.questionId ?? q.id) === String(backendQId),
                  ) || localQuestions[questionIndex];

                if (!localQuestion) {
                  return {
                    ...backendQuestion,
                    questionId: backendQId,
                    options: (backendQuestion.options || []).map(
                      (backendOption: any, optionIndex: number) => ({
                        ...backendOption,
                        optionId:
                          backendOption.optionId ?? backendOption.id ?? null,
                        displayOrder:
                          backendOption.optionOrder ||
                          backendOption.displayOrder ||
                          optionIndex + 1,
                        isCorrect: Boolean(
                          backendOption.isCorrect === true ||
                            backendOption.correct === true,
                        ),
                      }),
                    ),
                  };
                }

                return {
                  ...backendQuestion,
                  questionId:
                    backendQId ??
                    localQuestion.questionId ??
                    localQuestion.id ??
                    null,
                  explanation:
                    localQuestion.explanation ??
                    backendQuestion.explanation ??
                    "",
                  imageUrl:
                    localQuestion.imageUrl ?? backendQuestion.imageUrl ?? "",
                  options: (backendQuestion.options || []).map(
                    (backendOption: any, optionIndex: number) => {
                      const backendOptId =
                        backendOption.optionId ?? backendOption.id ?? null;

                      const localOption =
                        (localQuestion.options || []).find(
                          (opt: any) =>
                            backendOptId != null &&
                            (opt.optionId != null || opt.id != null) &&
                            String(opt.optionId ?? opt.id) ===
                              String(backendOptId),
                        ) || (localQuestion.options || [])[optionIndex];

                      return {
                        ...backendOption,
                        optionId:
                          backendOptId ??
                          localOption?.optionId ??
                          localOption?.id ??
                          null,
                        isCorrect: Boolean(
                          backendOption.correct ??
                            backendOption.isCorrect ??
                            localOption?.isCorrect ??
                            localOption?.correct ??
                            false,
                        ),
                      };
                    },
                  ),
                };
              },
            );
          } catch (error) {
            console.warn(
              "[DynoQuizz] Failed to merge localStorage question cache:",
              error,
            );

            return packageQuestions;
          }
        };

        // 1. Primary: GET /api/v1/teacher/quizzes/${draftId}
        const directRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${draftId}`,
          { headers },
        ).catch(() => null);

        if (directRes && directRes.ok) {
          data = await directRes.json();
          console.log("Draft Hydration Payload:", data);
        }

        let rawQuestions =
          data?.questions ||
          data?.quizPackage?.questions ||
          data?.package?.questions ||
          data?.questionList ||
          data?.data?.questions ||
          [];

        // If the teacher detail endpoint already returned questions, normalize them
        // with localStorage (for isCorrect restoration) and do not call student package endpoints.
        if (rawQuestions.length > 0) {
          rawQuestions = preferLocalStorageQuestions(rawQuestions);
        } else {
          // 2. Only use package endpoints when appropriate for published quizzes.
          // The student-facing package endpoint is not the authoritative draft-edit endpoint
          // and may reject DRAFT quizzes.
          const isPublished = data?.status === "PUBLISHED";

          if (isPublished) {
            try {
              const pkgByIdRes = await fetch(
                `${API_BASE}/api/v1/quizzes/${draftId}/package`,
                {
                  headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                },
              );
              if (pkgByIdRes.ok) {
                const pkgByIdData = await pkgByIdRes.json();
                console.log("Package-by-ID Payload:", pkgByIdData);
                const pkgByIdQuestions =
                  pkgByIdData.questions ||
                  pkgByIdData.quizPackage?.questions ||
                  pkgByIdData.package?.questions ||
                  pkgByIdData.data?.questions ||
                  [];
                rawQuestions = preferLocalStorageQuestions(pkgByIdQuestions);
                data = {
                  ...(data || {}),
                  ...pkgByIdData,
                  questions: rawQuestions,
                };
              }
            } catch (e) {
              console.warn("Package-by-ID fetch failed:", e);
            }

            // Secondary fallback for published quizzes: GET /api/v1/quizzes/code/{code}/package
            if (rawQuestions.length === 0) {
              try {
                const resolvedCode =
                  data?.quizCode ||
                  data?.testCode ||
                  getCachedQuizzes(user?.id).find(
                    (q: any) => String(q.quizId ?? q.id) === String(draftId),
                  )?.quizCode ||
                  null;
                if (resolvedCode) {
                  const pkgRes = await fetch(
                    `${API_BASE}/api/v1/quizzes/code/${encodeURIComponent(resolvedCode)}/package`,
                    {
                      headers: {
                        "Content-Type": "application/json",
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                      },
                    },
                  );
                  if (pkgRes.ok) {
                    const pkgData = await pkgRes.json();
                    console.log("Package-by-code Payload:", pkgData);
                    const pkgQuestions =
                      pkgData.questions ||
                      pkgData.quizPackage?.questions ||
                      pkgData.package?.questions ||
                      pkgData.data?.questions ||
                      [];
                    rawQuestions = preferLocalStorageQuestions(pkgQuestions);
                    data = {
                      ...(data || {}),
                      ...pkgData,
                      questions: rawQuestions,
                    };
                  }
                }
              } catch (e) {
                console.warn("Package-by-code fetch failed:", e);
              }
            }
          }

          // Fall back directly to localStorage when not published or package endpoints did not return questions
          if (rawQuestions.length === 0) {
            const localQuestions =
              localStorage.getItem(`draft_questions_${draftId}`) ||
              (data?.quizId
                ? localStorage.getItem(`draft_questions_${data.quizId}`)
                : null) ||
              (data?.id
                ? localStorage.getItem(`draft_questions_${data.id}`)
                : null);
            if (localQuestions) {
              try {
                rawQuestions = JSON.parse(localQuestions);
                console.log(
                  "Successfully restored questions from localStorage!",
                );
                data = {
                  ...(data || {}),
                  questions: rawQuestions,
                };
              } catch (parseErr) {
                console.error(
                  "Failed to parse cached questions from localStorage:",
                  parseErr,
                );
              }
            }
          }
        }

        // If still no questions, resolve access code from teacher quizzes roster
        if (rawQuestions.length === 0) {
          try {
            const rosterRes = await fetch(
              `${API_BASE}/api/v1/teacher/quizzes`,
              {
                headers,
              },
            );
            if (rosterRes.ok) {
              const rData = await rosterRes.json();
              const list = Array.isArray(rData)
                ? rData
                : Array.isArray(rData?.content)
                  ? rData.content
                  : Array.isArray(rData?.data)
                    ? rData.data
                    : [];
              const matched = list.find(
                (q: any) =>
                  String(q.quizId ?? q.id) === String(draftId) ||
                  String(q.quizCode ?? q.testCode ?? "") === String(draftId),
              );
              if (matched) {
                data = { ...(matched || {}), ...(data || {}) };
                const resolvedCode = matched.quizCode || matched.testCode;
                if (resolvedCode && matched.status === "PUBLISHED") {
                  const pkgRes = await fetch(
                    `${API_BASE}/api/v1/quizzes/code/${encodeURIComponent(resolvedCode)}/package`,
                    { headers },
                  );
                  if (pkgRes.ok) {
                    const pkgData = await pkgRes.json();
                    console.log(
                      "Fallback Package from Roster Payload:",
                      pkgData,
                    );
                    const rosterPkgQuestions =
                      pkgData.questions ||
                      pkgData.quizPackage?.questions ||
                      pkgData.package?.questions ||
                      pkgData.data?.questions ||
                      [];
                    // /package is student-facing — prefer localStorage if available
                    rawQuestions =
                      preferLocalStorageQuestions(rosterPkgQuestions);
                    data = {
                      ...data,
                      ...pkgData,
                      questions: rawQuestions,
                    };
                  }
                }
              }
            }
          } catch (e) {
            console.error("Fallback roster fetch failed:", e);
          }
        }

        // If still no questions, check localStorage cache
        if (rawQuestions.length === 0) {
          const cachedList = getCachedQuizzes();
          const cachedMatched = cachedList.find(
            (q: any) =>
              String(q.quizId ?? q.id) === String(draftId) ||
              String(q.quizCode ?? q.testCode ?? "") === String(draftId),
          );
          if (cachedMatched) {
            rawQuestions =
              cachedMatched.questions ||
              cachedMatched.quizPackage?.questions ||
              cachedMatched.package?.questions ||
              [];
            if (rawQuestions.length > 0) {
              data = {
                ...(data || {}),
                ...cachedMatched,
                questions: rawQuestions,
              };
            }
          }
        }

        if (!data) {
          const cachedRaw = localStorage.getItem(`quiz_draft_${draftId}`);
          if (cachedRaw) {
            try {
              data = JSON.parse(cachedRaw);
              if (!rawQuestions.length && Array.isArray(data?.questions)) {
                rawQuestions = data.questions;
              }
            } catch {}
          }
        }

        if (!data) {
          throw new Error(
            `Unable to retrieve draft assessment #${draftId} from the server.`,
          );
        }

        if (isMounted) {
          hydrateFromQuizData(data, rawQuestions);
        }
      } catch (err: any) {
        console.error("Error fetching draft assessment:", err);
        if (isMounted) {
          setValidationError(`Could not load draft: ${err.message}`);
        }
      } finally {
        if (isMounted) {
          setLoadingDraft(false);
        }
      }
    };

    fetchDraft();

    return () => {
      isMounted = false;
    };
  }, [draftId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setValidationError(null);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text || !text.trim()) {
        setValidationError("The uploaded file is empty.");
        setParsedQuestions([]);
        return;
      }

      if (file.name.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text);
          const rawList = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed.questions)
              ? parsed.questions
              : null;

          if (!rawList || rawList.length === 0) {
            setValidationError(
              "JSON file must contain a non-empty array of questions.",
            );
            return setParsedQuestions([]);
          }

          const validated: any[] = [];
          for (let idx = 0; idx < rawList.length; idx++) {
            const q = rawList[idx];
            const qNum = idx + 1;
            const qText = (q.questionText || q.text || "").trim();
            if (!qText)
              return (
                setValidationError(`Question ${qNum}: text is required.`),
                setParsedQuestions([])
              );

            let normalizedOpts: any[] = [];
            if (typeof q.options[0] === "string") {
              const strOpts: string[] = q.options.map((o: any) =>
                String(o).trim(),
              );
              const correctStr = (
                q.correctOption ||
                q.correctAnswer ||
                q.answer ||
                ""
              ).trim();
              if (!correctStr)
                return (
                  setValidationError(
                    `Question ${qNum}: correct option required.`,
                  ),
                  setParsedQuestions([])
                );

              const matchedIndex = strOpts.findIndex(
                (o) =>
                  o.toLowerCase() === correctStr.toLowerCase() ||
                  (correctStr.length === 1 &&
                    String.fromCharCode(65 + strOpts.indexOf(o)) ===
                      correctStr.toUpperCase()),
              );

              normalizedOpts = strOpts.map((optText, oIdx) => ({
                optionText: optText,
                optionImage: "",
                optionOrder: oIdx + 1,
                isCorrect:
                  oIdx ===
                  (matchedIndex !== -1
                    ? matchedIndex
                    : strOpts.indexOf(correctStr)),
              }));
            } else {
              normalizedOpts = q.options.map((opt: any, oIdx: number) => ({
                optionText: (opt.optionText || opt.text).trim(),
                optionImage: "",
                optionOrder: opt.optionOrder || oIdx + 1,
                isCorrect: !!opt.isCorrect,
              }));
            }

            validated.push({
              questionText: qText,
              imageUrl: "",
              explanation: q.explanation || "",
              questionType: q.questionType || "MCQ",
              marks: Number(q.marks) || 1,
              negativeMarks:
                q.negativeMarks !== undefined
                  ? Number(q.negativeMarks)
                  : negativeMarking
                    ? 0.25
                    : 0,
              questionTimerSeconds: q.questionTimerSeconds || 60,
              difficulty: q.difficulty || "MEDIUM",
              displayOrder: qNum,
              options: normalizedOpts,
            });
          }
          setParsedQuestions(validated);
        } catch (err: any) {
          setValidationError(`Failed to parse JSON file.`);
          setParsedQuestions([]);
        }
      } else {
        Papa.parse(text, {
          skipEmptyLines: true,
          complete: (results) => {
            const rows = results.data as string[][];
            if (rows.length === 0) {
              setValidationError("CSV file is empty.");
              return setParsedQuestions([]);
            }

            const firstLineLower = rows[0].join(" ").toLowerCase();
            const hasHeader =
              firstLineLower.includes("question") ||
              firstLineLower.includes("option");
            const contentRows = hasHeader ? rows.slice(1) : rows;

            const validatedQuestions: any[] = [];
            for (let index = 0; index < contentRows.length; index++) {
              const parts = contentRows[index].map((s) => s.trim());
              if (parts.length < 3) continue;

              const qText = parts[0];
              const optA = parts[1] || "";
              const optB = parts[2] || "";
              const optC = parts[3] || "";
              const optD = parts[4] || "";
              const correctIdentifier = (
                parts[5] ||
                parts[parts.length - 1] ||
                ""
              ).trim();

              const availableOptions = [
                { text: optA, letter: "A" },
                { text: optB, letter: "B" },
                ...(optC ? [{ text: optC, letter: "C" }] : []),
                ...(optD ? [{ text: optD, letter: "D" }] : []),
              ];

              const matchedOptIndex = availableOptions.findIndex(
                (o) =>
                  o.letter.toUpperCase() === correctIdentifier.toUpperCase() ||
                  o.text.toLowerCase() === correctIdentifier.toLowerCase(),
              );

              validatedQuestions.push({
                questionText: qText,
                imageUrl: "",
                explanation: "",
                questionType: "MCQ",
                marks: parts[6] ? Number(parts[6]) : 1,
                negativeMarks: negativeMarking ? 0.25 : 0,
                questionTimerSeconds: 60,
                difficulty: "MEDIUM",
                displayOrder: index + 1,
                options: availableOptions.map((opt, oIdx) => ({
                  optionText: opt.text,
                  optionImage: "",
                  optionOrder: oIdx + 1,
                  isCorrect:
                    oIdx === (matchedOptIndex === -1 ? 0 : matchedOptIndex),
                })),
              });
            }
            setParsedQuestions(validatedQuestions);
          },
        });
      }
    };
    reader.readAsText(file);
  };

  const handleAddNewQuestion = () => {
    setValidationError(null);
    setParsedQuestions((prev) => [
      ...prev,
      {
        questionText: "",
        imageUrl: "",
        explanation: "",
        questionType: "MCQ",
        marks: 1,
        negativeMarks: negativeMarking ? 0.25 : 0,
        questionTimerSeconds: 60,
        difficulty: "MEDIUM",
        displayOrder: prev.length + 1,
        options: [
          { optionText: "", optionImage: "", optionOrder: 1, isCorrect: true },
          { optionText: "", optionImage: "", optionOrder: 2, isCorrect: false },
          { optionText: "", optionImage: "", optionOrder: 3, isCorrect: false },
          { optionText: "", optionImage: "", optionOrder: 4, isCorrect: false },
        ],
      },
    ]);
  };

  const handleUpdateQuestionField = (
    idx: number,
    field: string,
    value: any,
  ) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, [field]: value } : q)),
    );
  };

  const handleUpdateOption = (
    qIdx: number,
    optIdx: number,
    textValue: string,
  ) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = [...q.options];
        newOpts[optIdx] = { ...newOpts[optIdx], optionText: textValue };
        return { ...q, options: newOpts };
      }),
    );
  };

  const handleSetCorrectOption = (qIdx: number, optIdx: number) => {
    setParsedQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const newOpts = q.options.map((opt: any, oi: number) => ({
          ...opt,
          isCorrect: oi === optIdx,
        }));
        return { ...q, options: newOpts };
      }),
    );
  };

  const handleDeleteQuestion = (idx: number) => {
    setParsedQuestions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, displayOrder: i + 1 })),
    );
  };

  // Shared validation — used by both Publish and Save as Draft flows.
  const validateForm = (): string | null => {
    if (!title.trim()) return "Please enter an assessment title.";
    if (parsedQuestions.length === 0)
      return "Please add at least one question before saving.";
    for (let i = 0; i < parsedQuestions.length; i++) {
      if (!parsedQuestions[i].questionText.trim())
        return `Question ${i + 1} cannot have empty text.`;
      for (let j = 0; j < parsedQuestions[i].options.length; j++) {
        if (!parsedQuestions[i].options[j].optionText.trim())
          return `Option ${String.fromCharCode(65 + j)} in Question ${i + 1} cannot be empty.`;
      }
    }
    return null;
  };

  // Build the POST payload. Status is sent as PUBLISHED to match original
  // behavior — the backend uses the separate PUT /publish call to actually
  // transition the quiz to live state.
  // forPost=true  → POST /teacher/quizzes   (new quiz):   options use `isCorrect`, no questionId/optionId
  // forPost=false → PUT  /teacher/quizzes/id (edit/draft): options use `correct`,    includes IDs
  const buildPayload = (forPost: boolean = false) => {
    // --- FIX 1: Timestamp & Availability window ---
    const now = new Date();
    // Shift start time back by 5 minutes to bypass slight server clock mismatches
    const startTime = new Date(now.getTime() - 5 * 60000);
    // Give a 24-hour window for the quiz to remain "Available" in the lobby
    // (The test duration itself is still strictly enforced by overallTimerSeconds)
    const endTime = new Date(now.getTime() + 24 * 60 * 60000);

    const resultVis =
      publishScoresImmediately && revealSolutions
        ? "BOTH"
        : publishScoresImmediately
          ? "LEADERBOARD"
          : revealSolutions
            ? "QUESTION_WISE"
            : "NONE";

    // Process authorized rolls
    const allowedRollsArray = allowedRollsText
      .split(",")
      .map((roll) => roll.trim())
      .filter((roll) => roll.length > 0);

    return {
      // teacherId intentionally omitted: the OpenAPI CreateQuizRequest schema
      // does not include it. The backend resolves the teacher from the
      // authenticated JWT principal via Spring Security's authentication context.
      title: title.trim(),
      description: description.trim(),
      instructions: instructions.trim(),
      subject: subject.trim(),
      subjectCode: subjectCode.trim(),
      overallTimerSeconds: Math.floor(timeLimit * 60),
      negativeMarking: Boolean(negativeMarking),
      negativeMarks: Number(negativeMarking ? negativeMarks : 0),
      timeBonusEnabled: false,
      randomQuestionOrder: true,
      randomOptionOrder: true,
      allowReview: true,
      allowResume: true,
      autoSubmit: true,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      resultVisibility: resultVis,
      totalStudents: allowedRollsArray.length,
      acceptedEmailDomain:
        acceptedDomain.trim() === "" ? null : acceptedDomain.trim(),
      allowedRegistrationNumbers: allowedRollsArray,
      questions: parsedQuestions.map((q: any, index: number) => {
        const baseOption = (opt: any, optIndex: number) => ({
          optionText: String(opt.optionText).trim(),
          optionImage: opt.optionImage || "",
          optionOrder:
            opt.displayOrder || opt.optionOrder || Number(optIndex + 1),
        });

        return {
          // POST schema has no questionId; only include it on PUT
          ...(forPost ? {} : { questionId: q.questionId ?? q.id ?? null }),
          questionText: String(q.questionText).trim(),
          imageUrl: q.imageUrl || "",
          explanation: String(q.explanation || "").trim(),
          questionType:
            q.questionType === "MULTIPLE_CHOICE"
              ? "MCQ"
              : q.questionType || "MCQ",
          marks: Number(q.marks || 1),
          negativeMarks: Number(negativeMarking ? negativeMarks : 0),
          questionTimerSeconds: Number(q.questionTimerSeconds || 60),
          difficulty: q.difficulty || "MEDIUM",
          displayOrder: q.displayOrder || Number(index + 1),
          options: q.options.map((opt: any, optIndex: number) =>
            forPost
              ? // POST expects `isCorrect`, no optionId
                {
                  ...baseOption(opt, optIndex),
                  isCorrect: Boolean(opt.isCorrect),
                }
              : // PUT expects `correct` + optionId
                {
                  ...baseOption(opt, optIndex),
                  optionId: opt.optionId ?? opt.id ?? null,
                  correct: Boolean(opt.isCorrect),
                },
          ),
        };
      }),
    };
  };

  // ── "Publish Assessment" handler ──────────────────────────────────────────
  // Flow: validate → POST (create) → PUT /publish → navigate to share page.
  // If create fails: show error, do not navigate, do not publish.
  // If create succeeds but publish fails: show inline error with Retry button
  //   that only re-attempts the publish call (no duplicate quiz created).
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const formErr = validateForm();
    if (formErr) return setValidationError(formErr);

    setSubmitting(true);
    setValidationError(null);

    const token = localStorage.getItem("dynoquizz_token");

    // ── JWT diagnostic instrumentation ────────────────────────────────────
    if (token) {
      const parts = token.split(".");
      const isWellFormed = parts.length === 3;
      let jwtPayload: any = null;
      let isFallbackToken = false;
      try {
        jwtPayload = JSON.parse(atob(parts[1]));
        // Fallback tokens (frontend-signed) use email as userId/sub and lack
        // a numeric "id" field that Spring Boot's CustomUserDetails would have.
        // Spring Security throws `String cannot be cast to CustomUserDetails`
        // when the principal is such a bare-string subject.
        isFallbackToken =
          typeof jwtPayload?.userId === "string" &&
          (jwtPayload?.userId?.includes("@") ?? false) &&
          !jwtPayload?.id;
      } catch {
        // malformed payload segment
      }
      console.group("[DynoQuizz] Quiz-creation token diagnostics");
      console.log(
        "Token length:",
        token.length,
        "| First 12:",
        token.slice(0, 12),
        "| Last 12:",
        token.slice(-12),
      );
      console.log("Well-formed JWT (3 segments):", isWellFormed);
      if (jwtPayload) {
        const expMs = (jwtPayload.exp || 0) * 1000;
        const nowMs = Date.now();
        console.log(
          "JWT exp:",
          new Date(expMs).toISOString(),
          "| Current time:",
          new Date(nowMs).toISOString(),
          "| Expired:",
          nowMs > expMs,
        );
        console.log(
          "JWT sub/userId:",
          jwtPayload.sub || jwtPayload.userId,
          "| role:",
          jwtPayload.role,
        );
        if (isFallbackToken) {
          console.warn(
            "[DynoQuizz] ⚠️  FALLBACK TOKEN DETECTED — this is a frontend-signed JWT" +
              " (the Spring Boot backend was unreachable at login time). Spring Security" +
              " will reject it with 'String cannot be cast to CustomUserDetails'." +
              " The teacher must log out and log in again while the backend is running.",
          );
        }
      }
      console.groupEnd();
    } else {
      console.warn(
        "[DynoQuizz] No dynoquizz_token found in localStorage before quiz creation POST.",
      );
    }
    // ──────────────────────────────────────────────────────────────────────

    try {
      const isEditing = Boolean(draftId);

      // Helper: persist the full state bundle so the edit page can restore
      // everything (title, subject, settings, questions with isCorrect) instantly
      // from localStorage without any network round-trips.
      const saveFullDraftBundle = (
        quizId: number | string,
        quizCodeValue: string = "",
      ) => {
        const fullDraftData = {
          quizCode: quizCodeValue,
          quizId,
          title: title.trim(),
          subject: subject.trim(),
          subjectCode: subjectCode.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          overallTimerSeconds: Math.floor(timeLimit * 60),
          negativeMarking: Boolean(negativeMarking),
          negativeMarks: Number(negativeMarking ? negativeMarks : 0),
          timeBonusEnabled: false,
          randomQuestionOrder: true,
          randomOptionOrder: true,
          allowReview: true,
          allowResume: true,
          autoSubmit: true,
          publishScoresImmediately: Boolean(publishScoresImmediately),
          revealSolutions: Boolean(revealSolutions),
          acceptedEmailDomain:
            acceptedDomain.trim() === "" ? null : acceptedDomain.trim(),
          allowedRegistrationNumbers: [],
          allowedRollsText,
          questions: parsedQuestions,
        };

        localStorage.setItem(
          `quiz_draft_${quizId}`,
          JSON.stringify(fullDraftData),
        );

        if (parsedQuestions.length > 0) {
          localStorage.setItem(
            `draft_questions_${quizId}`,
            JSON.stringify(parsedQuestions),
          );
        }
      };
      // Keep the legacy questions-only key for the preferLocalStorageQuestions helper
      let rawQuizId: number | string | null = null;
      let quizCode = "";
      if (isEditing) {
        // ── Edit path: PUT /api/v1/teacher/quizzes/{quizId}/settings ──────────
        const settingsPayload = {
          ...buildPayload(false), // false = PUT schema (correct + optionId)
          quizId: Number(draftId),
        };

        const settingsRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${draftId}/settings`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(settingsPayload),
          },
        );

        if (!settingsRes.ok) {
          const errData = await settingsRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              `Server returned status: ${settingsRes.status}`,
          );
        }

        const settingsData = await settingsRes.json().catch(() => ({}));

        rawQuizId = settingsData.quizId ?? settingsData.id ?? draftId;

        const cachedDraftRaw = localStorage.getItem(`quiz_draft_${draftId}`);

        let cachedDraft: any = {};

        try {
          cachedDraft = cachedDraftRaw ? JSON.parse(cachedDraftRaw) : {};
        } catch {
          cachedDraft = {};
        }

        quizCode =
          settingsData.quizCode ??
          settingsData.testCode ??
          cachedDraft.quizCode ??
          getCachedQuizzes(user?.id).find(
            (q: any) => String(q.quizId ?? q.id) === String(draftId),
          )?.quizCode ??
          "";

        const updatedQuizData = {
          ...settingsData,
          quizId: rawQuizId,
          quizCode,
          title: settingsData.title || title.trim(),
          subject: settingsData.subject || subject.trim(),
          subjectCode: settingsData.subjectCode || subjectCode.trim(),
          description: settingsData.description ?? description.trim(),
          instructions: settingsData.instructions ?? instructions.trim(),
          overallTimerSeconds:
            settingsData.overallTimerSeconds ?? Math.floor(timeLimit * 60),
          acceptedEmailDomain:
            settingsData.acceptedEmailDomain ?? (acceptedDomain.trim() || null),
          questions: parsedQuestions,
        };

        localStorage.setItem(
          `quiz_draft_${draftId}`,
          JSON.stringify(updatedQuizData),
        );

        if (rawQuizId && String(rawQuizId) !== String(draftId)) {
          localStorage.setItem(
            `quiz_draft_${rawQuizId}`,
            JSON.stringify(updatedQuizData),
          );
        }
      } else {
        // ── Create path: POST /api/v1/teacher/quizzes ─────────────────────────
        const createRes = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(buildPayload(true)), // true = POST schema (isCorrect, no IDs)
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              `Server returned status: ${createRes.status}`,
          );
        }

        const createData = await createRes.json().catch(() => ({}));
        rawQuizId = createData.quizId ?? createData.id ?? null;
        quizCode =
          createData.quizCode ?? createData.testCode ?? "";
      }

      if (!rawQuizId) throw new Error("Quiz response missing quizId");
      const numericQuizId = Number(rawQuizId);

      // Persist full state bundle (metadata + questions) for instant edit hydration
      saveFullDraftBundle(numericQuizId, quizCode);
      if (draftId && String(draftId) !== String(numericQuizId)) {
        saveFullDraftBundle(draftId, quizCode);
      }

      // ── Publish: PUT /api/v1/teacher/quizzes/{quizId}/publish ────────────
      try {
        const pubRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${numericQuizId}/publish`,
          {
            method: "PUT",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        if (!pubRes.ok) {
          const errData = await pubRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              `Server status: ${pubRes.status}`,
          );
        }

        // Redirect to /dashboard/teacher/share/<quizCode> only AFTER publish succeeds
        router.push(`/dashboard/teacher/share/${quizCode}`);
      } catch (pubErr: any) {
        console.error(
          "Failed to publish quiz immediately after creation:",
          pubErr,
        );
        setPublishRetryData({
          quizId: numericQuizId,
          quizCode: String(quizCode),
        });
        setValidationError(
          `Quiz was created but could not be published. Retry${pubErr.message ? ` (${pubErr.message})` : ""}`,
        );
      }
    } catch (err: any) {
      console.error("Failed to create quiz:", err);
      setValidationError(`Failed to create assessment: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── "Save as Draft" handler ───────────────────────────────────────────────
  // Flow: validate → POST / PUT (save draft) → navigate to dashboard (no publish call).
  // The quiz will appear on the dashboard with a Draft badge and Publish button.
  const [savingDraft, setSavingDraft] = useState(false);

  const handleSaveDraft = async () => {
    const formErr = validateForm();
    if (formErr) return setValidationError(formErr);

    setSavingDraft(true);
    setValidationError(null);

    const token = localStorage.getItem("dynoquizz_token");

    try {
      const isEditing = Boolean(draftId);

      // Build the full state bundle for localStorage (same shape as handleSave)
      const saveFullDraftBundle = (
        quizId: number | string,
        quizCodeValue: string = "",
      ) => {
        const fullDraftData = {
          quizCode: quizCodeValue,
          quizId,
          title: title.trim(),
          subject: subject.trim(),
          subjectCode: subjectCode.trim(),
          description: description.trim(),
          instructions: instructions.trim(),
          overallTimerSeconds: Math.floor(timeLimit * 60),
          negativeMarking: Boolean(negativeMarking),
          negativeMarks: Number(negativeMarking ? negativeMarks : 0),
          timeBonusEnabled: false,
          randomQuestionOrder: true,
          randomOptionOrder: true,
          allowReview: true,
          allowResume: true,
          autoSubmit: true,
          publishScoresImmediately: Boolean(publishScoresImmediately),
          revealSolutions: Boolean(revealSolutions),
          acceptedEmailDomain:
            acceptedDomain.trim() === "" ? null : acceptedDomain.trim(),
          allowedRegistrationNumbers: [],
          allowedRollsText,
          questions: parsedQuestions,
        };

        localStorage.setItem(
          `quiz_draft_${quizId}`,
          JSON.stringify(fullDraftData),
        );

        if (parsedQuestions.length > 0) {
          localStorage.setItem(
            `draft_questions_${quizId}`,
            JSON.stringify(parsedQuestions),
          );
        }
      };

      let returnedQuizId: number | string | null = null;
      let returnedQuizCode = "";

      if (isEditing) {
        // ── Edit path: PUT /api/v1/teacher/quizzes/{quizId}/settings ──────────
        const settingsPayload = {
          ...buildPayload(false), // false = PUT schema (correct + optionId)
          quizId: Number(draftId),
        };

        const settingsRes = await fetch(
          `${API_BASE}/api/v1/teacher/quizzes/${draftId}/settings`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify(settingsPayload),
          },
        );

        if (!settingsRes.ok) {
          const errData = await settingsRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              `Server returned status: ${settingsRes.status}`,
          );
        }

        const settingsData = await settingsRes.json().catch(() => ({}));

        returnedQuizId = settingsData.quizId ?? settingsData.id ?? draftId;

        const cachedDraftRaw = localStorage.getItem(`quiz_draft_${draftId}`);

        let cachedDraft: any = {};

        try {
          cachedDraft = cachedDraftRaw ? JSON.parse(cachedDraftRaw) : {};
        } catch {
          cachedDraft = {};
        }

        returnedQuizCode =
          settingsData.quizCode ??
          settingsData.testCode ??
          cachedDraft.quizCode ??
          getCachedQuizzes(user?.id).find(
            (q: any) => String(q.quizId ?? q.id) === String(draftId),
          )?.quizCode ??
          "";

        // Inside the successful PUT /settings response block:
        const updatedQuizData = {
          ...settingsData, // The response JSON containing title, subject, timers, etc.
          title: settingsData.title || title.trim(),
          subject: settingsData.subject || subject.trim(),
          subjectCode: settingsData.subjectCode || subjectCode.trim(),
          description: settingsData.description ?? description.trim(),
          instructions: settingsData.instructions ?? instructions.trim(),
          overallTimerSeconds:
            settingsData.overallTimerSeconds ?? Math.floor(timeLimit * 60),
          acceptedEmailDomain:
            settingsData.acceptedEmailDomain ?? (acceptedDomain.trim() || null),
          questions: parsedQuestions, // Ensures we keep the frontend's answer key intact
        };
        localStorage.setItem(
          `quiz_draft_${draftId}`,
          JSON.stringify(updatedQuizData),
        );
        if (returnedQuizId && String(returnedQuizId) !== String(draftId)) {
          localStorage.setItem(
            `quiz_draft_${returnedQuizId}`,
            JSON.stringify(updatedQuizData),
          );
        }
      } else {
        const createPayload = buildPayload(true); // true = POST schema (isCorrect, no IDs)

        const createRes = await fetch(`${API_BASE}/api/v1/teacher/quizzes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(createPayload),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(
            errData.message ||
              errData.error ||
              `Server returned status: ${createRes.status}`,
          );
        }

        const createData = await createRes.json().catch(() => ({}));

        returnedQuizId = createData.quizId ?? createData.id ?? null;

        returnedQuizCode = createData.quizCode ?? createData.testCode ?? "";
      }

      // Persist full state bundle (metadata + questions with isCorrect)
      if (returnedQuizId) {
        saveFullDraftBundle(returnedQuizId, returnedQuizCode);
      }

      if (draftId && String(draftId) !== String(returnedQuizId)) {
        saveFullDraftBundle(draftId, returnedQuizCode);
      }

      // Draft created or updated — redirect to dashboard where it will show a Draft badge
      router.push("/dashboard/teacher");
    } catch (err: any) {
      console.error("Failed to save draft:", err);
      setValidationError(`Failed to save draft: ${err.message}`);
    } finally {
      setSavingDraft(false);
    }
  };

  const handleRetryPublish = async () => {
    if (!publishRetryData) return;
    setRetryingPublish(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("dynoquizz_token")
        : null;

    try {
      const pubRes = await fetch(
        `${API_BASE}/api/v1/teacher/quizzes/${publishRetryData.quizId}/publish`,
        {
          method: "PUT",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (!pubRes.ok) {
        const errData = await pubRes.json().catch(() => ({}));
        throw new Error(
          errData.message || errData.error || `Server status: ${pubRes.status}`,
        );
      }

      router.push(`/dashboard/teacher/share/${publishRetryData.quizCode}`);
    } catch (err: any) {
      setValidationError(
        `Quiz was created but could not be published. Retry${err.message ? ` (${err.message})` : ""}`,
      );
    } finally {
      setRetryingPublish(false);
    }
  };

  const inputClass =
    "w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3.5 py-2.5 text-xs text-[#111111] outline-none transition-all placeholder:text-[#a8a29d] hover:border-[#b9cbd9] focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10 font-medium shadow-xs";

  const labelClass =
    "mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#78716b]";

  if (loadingDraft) {
    return (
      <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 flex items-center justify-center text-left">
        <div className="flex items-center gap-3 rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#165dfb]/30 border-t-[#165dfb]" />
          <span className="text-xs font-bold text-[#78716b]">
            Loading draft assessment...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 text-left">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-4 border-b border-[#d1dee8]/60 bg-[#f5f5f4]/85 px-4 py-4 backdrop-blur-md md:-mx-6 md:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/teacher"
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[#d1dee8]/80 bg-white text-[#78716b] shadow-xs transition-all hover:border-[#b9cbd9] hover:bg-white hover:text-[#111111] active:scale-95"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Link>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716b]">
                {draftId ? "EDIT DRAFT ASSESSMENT" : "ASSESSMENT BUILDER"}
              </span>
              <h1 className="text-xl font-extrabold text-[#111111] -tracking-wide mt-0.5">
                {draftId ? "Edit your draft" : "Create your assessment"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-[#d1dee8]/80 bg-white px-3 py-1 text-[10px] font-bold text-[#78716b] shadow-xs sm:inline-flex">
              {parsedQuestions.length}{" "}
              {parsedQuestions.length === 1 ? "question" : "questions"}
            </span>
            <button
              onClick={(e) => handleSave(e)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[#165dfb] px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {submitting ? "Publishing..." : "Publish Assessment"}
            </button>
          </div>
        </header>

        {validationError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-[10px] border border-[#8c381c]/25 bg-[#fbeee8] p-3.5 text-xs font-semibold text-[#8c381c] shadow-xs"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span className="leading-relaxed">{validationError}</span>
            </div>
            {publishRetryData && (
              <button
                type="button"
                onClick={handleRetryPublish}
                disabled={retryingPublish}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[#8c381c] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#6e2b14] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer border-0 shrink-0 shadow-xs"
              >
                {retryingPublish && (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                )}
                Retry
              </button>
            )}
          </div>
        )}

        <form onSubmit={(e) => handleSave(e)} className="space-y-6">
          <div className="rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 space-y-5 shadow-sm">
            <h3 className="flex items-center gap-2 border-b border-[#d1dee8]/50 pb-3 text-xs font-bold uppercase tracking-wider text-[#111111]">
              <span className="h-3.5 w-1 rounded-full bg-[#165dfb]" />
              Assessment Details
            </h3>
            <div className="space-y-4">
              <div className="text-left">
                <label className={labelClass}>Assessment Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms — Midterm"
                  className={`${inputClass} text-sm`}
                  required
                />
              </div>
              <div className="text-left">
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What this assessment covers"
                  className={`${inputClass} resize-y leading-relaxed`}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-left">
                  <label className={labelClass}>Subject Name</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className={labelClass}>Subject Code</label>
                  <input
                    type="text"
                    value={subjectCode}
                    onChange={(e) => setSubjectCode(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="text-left">
                  <label className={labelClass}>Time Limit (minutes)</label>
                  <div className="flex items-center gap-2 rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3 py-2.5 transition-all hover:border-[#b9cbd9] focus-within:border-[#165dfb] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#165dfb]/10 shadow-xs">
                    <Clock className="h-4 w-4 shrink-0 text-[#78716b]" />
                    <input
                      type="number"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      min="1"
                      className="bg-transparent outline-none w-full text-xs font-bold text-[#111111]"
                      required
                    />
                    <span className="text-[10px] font-bold uppercase text-[#a8a29d]">
                      min
                    </span>
                  </div>
                </div>
                <div className="text-left sm:col-span-3">
                  <label className={labelClass}>
                    Authorized Student Roll Numbers (Optional)
                  </label>
                  <textarea
                    value={allowedRollsText}
                    onChange={(e) => setAllowedRollsText(e.target.value)}
                    rows={2}
                    placeholder="Comma separated, e.g. 21BCE1001, 21BCE1002"
                    className={`${inputClass} resize-y leading-relaxed`}
                  />
                  <p className="mt-1 text-[11px] text-[#78716b]">
                    Leave blank to allow any student to join.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d1dee8]/50 pb-2.5">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#111111]">
                <span className="h-3.5 w-1 rounded-full bg-[#165dfb]" />
                Questions
                <span className="rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[10px] font-bold text-[#165dfb]">
                  {parsedQuestions.length}
                </span>
              </h3>
            </div>

            {parsedQuestions.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-[#d1dee8] bg-white px-6 py-10 text-center shadow-xs">
                <FileQuestion className="mx-auto mb-3 h-8 w-8 text-[#c9c5c2]" />
                <p className="text-xs font-bold text-[#57534e]">
                  No questions yet
                </p>
                <p className="mt-1 text-xs text-[#a8a29d]">
                  Import a CSV or JSON file, or add a question card below.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {parsedQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-[14px] border border-[#d1dee8]/70 bg-white shadow-sm transition-all hover:border-[#b9cbd9] hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[#d1dee8]/50 bg-[#fbfbfa] px-5 py-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold text-[#57534e]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-[#eef4ff] font-mono text-[10px] font-bold text-[#165dfb]">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        Question
                      </span>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                          Marks
                        </label>
                        <input
                          type="number"
                          value={q.marks}
                          onChange={(e) =>
                            handleUpdateQuestionField(
                              idx,
                              "marks",
                              Number(e.target.value),
                            )
                          }
                          className="w-14 rounded-[8px] border border-[#d1dee8]/80 bg-white px-2 py-1 text-center text-xs font-bold text-[#111111] outline-none transition-all focus:border-[#165dfb] focus:ring-4 focus:ring-[#165dfb]/10 shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(idx)}
                          aria-label={`Delete question ${idx + 1}`}
                          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#a8a29d] transition-all hover:bg-[#fbeee8] hover:text-[#8c381c] active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) =>
                          handleUpdateQuestionField(
                            idx,
                            "questionText",
                            e.target.value,
                          )
                        }
                        placeholder="Type your question"
                        className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3.5 py-2.5 text-sm font-semibold text-[#111111] outline-none transition-all placeholder:font-medium placeholder:text-[#a8a29d] hover:border-[#b9cbd9] focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10 shadow-xs"
                      />

                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {q.options.map((opt: any, oi: number) => (
                          <div
                            key={oi}
                            className={`flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-xs transition-all ${
                              opt.isCorrect
                                ? "border-[#165dfb] bg-[#eef4ff] shadow-[0_0_0_3px_rgba(22,93,251,0.08)]"
                                : "border-[#d1dee8]/80 bg-white hover:border-[#b9cbd9] hover:bg-[#fbfbfa] shadow-xs"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(idx, oi)}
                              aria-label={`Mark option ${String.fromCharCode(65 + oi)} correct`}
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                                opt.isCorrect
                                  ? "bg-[#165dfb] text-white shadow-xs shadow-[#165dfb]/30"
                                  : "bg-[#f0eeed] text-[#78716b] hover:bg-[#e2dfdd] hover:text-[#111111]"
                              }`}
                            >
                              {opt.isCorrect ? (
                                <Check
                                  className="h-3.5 w-3.5"
                                  strokeWidth={3}
                                />
                              ) : (
                                String.fromCharCode(65 + oi)
                              )}
                            </button>
                            <input
                              type="text"
                              value={opt.optionText}
                              placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                              onChange={(e) =>
                                handleUpdateOption(idx, oi, e.target.value)
                              }
                              className={`w-full bg-transparent outline-none placeholder:text-[#a8a29d] ${
                                opt.isCorrect
                                  ? "font-semibold text-[#0f3fa8]"
                                  : "text-[#111111]"
                              }`}
                            />
                            {opt.isCorrect && (
                              <span className="shrink-0 rounded-full bg-[#165dfb]/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#165dfb]">
                                Correct
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-[14px] border border-dashed border-[#bcd9c9] bg-[#eef8f3]/60 p-6 text-center transition-all hover:border-[#165dfb] hover:bg-[#ecf5ff]/70 shadow-xs">
              <input
                type="file"
                id="csv-upload"
                className="hidden"
                accept=".csv, .json"
                onChange={handleFileUpload}
              />
              <label htmlFor="csv-upload" className="cursor-pointer block">
                <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] bg-white shadow-xs ring-1 ring-[#165dfb]/10">
                  <FileType className="h-5 w-5 text-[#165dfb]" />
                </span>
                <h4 className="text-xs font-bold text-[#111111]">
                  Import via CSV or JSON
                </h4>
                <p className="mt-1 text-[11px] text-[#78716b]">
                  Question, options, then the correct answer
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8]/80 bg-white px-4 py-2 text-xs font-bold shadow-xs transition-all hover:border-[#165dfb] hover:text-[#165dfb] active:scale-95">
                  <Upload className="h-3.5 w-3.5" /> Select File
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddNewQuestion}
              className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[#d1dee8] bg-white py-3.5 text-xs font-bold text-[#165dfb] shadow-xs transition-all hover:border-[#165dfb] hover:bg-[#eef4ff] active:scale-[0.99]"
            >
              <PlusCircle className="h-4 w-4" /> Add Custom Question Card
            </button>
          </div>

          <div className="overflow-hidden rounded-[14px] border border-[#d1dee8]/70 bg-[#f1efff]/40 shadow-sm">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
              className="flex w-full items-center justify-between bg-[#f1efff]/70 p-4 text-xs font-bold uppercase tracking-wider text-[#4c3d73] transition-colors hover:bg-[#eae6ff]"
            >
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Advanced Settings
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-[#d1dee8]/30"
                >
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        label: "Release Scores Instantly",
                        val: publishScoresImmediately,
                        setter: setPublishScoresImmediately,
                      },
                      {
                        label: "Allow Students to View Solutions",
                        val: revealSolutions,
                        setter: setRevealSolutions,
                      },
                      {
                        label: "Enable Negative Marking",
                        val: negativeMarking,
                        setter: setNegativeMarking,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center justify-between gap-3 rounded-[10px] border bg-white p-3.5 shadow-xs transition-all ${
                          item.val
                            ? "border-[#165dfb]/40 shadow-[0_0_0_3px_rgba(22,93,251,0.06)]"
                            : "border-[#d1dee8]/80 hover:border-[#b9cbd9]"
                        }`}
                      >
                        <span className="block text-xs font-bold text-[#111111]">
                          {item.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => item.setter(!item.val)}
                          role="switch"
                          aria-checked={item.val}
                          aria-label={item.label}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-4 focus-visible:ring-[#165dfb]/20 ${item.val ? "bg-[#165dfb]" : "bg-[#d1dee8]"}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${item.val ? "translate-x-4" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#d1dee8]/30 px-4 pb-4 pt-3 text-left">
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-[#57534e]">
                      Accepted Email Domain
                    </label>
                    <input
                      type="text"
                      value={acceptedDomain}
                      onChange={(e) => setAcceptedDomain(e.target.value)}
                      placeholder="e.g., @vitap.ac.in"
                      className="w-full rounded-[10px] border border-[#d1dee8]/80 bg-[#fbfbfa] px-3.5 py-2.5 text-xs font-bold text-[#111111] outline-none transition-all placeholder:font-medium placeholder:text-[#a8a29d] hover:border-[#b9cbd9] focus:border-[#165dfb] focus:bg-white focus:ring-4 focus:ring-[#165dfb]/10 shadow-xs"
                    />
                    <p className="mt-1 text-[11px] text-[#78716b]">
                      Only students with a matching email domain can join. Leave
                      blank to allow any domain.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>

        {/* ── Bottom action row: Save as Draft | Publish Assessment ─────── */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pb-8">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || submitting}
            className="inline-flex items-center gap-2 rounded-[10px] border border-[#d1dee8]/80 bg-white px-5 py-2.5 text-xs font-bold text-[#111111] shadow-sm hover:bg-[#f5f5f4] hover:border-[#b9cbd9] active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingDraft && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#78716b]/30 border-t-[#78716b]" />
            )}
            {savingDraft
              ? "Saving..."
              : draftId
                ? "Save Changes"
                : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={(e) => handleSave(e as any)}
            disabled={submitting || savingDraft}
            className="inline-flex items-center gap-2 rounded-[10px] bg-[#165dfb] px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-[#165dfb]/25 transition-all hover:bg-[#0f4fd8] hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {submitting ? "Publishing..." : "Publish Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] p-4 md:p-6 lg:p-8 flex items-center justify-center text-left">
          <div className="flex items-center gap-3 rounded-[14px] border border-[#d1dee8]/70 bg-white p-6 shadow-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#165dfb]/30 border-t-[#165dfb]" />
            <span className="text-xs font-bold text-[#78716b]">
              Loading assessment builder...
            </span>
          </div>
        </div>
      }
    >
      <CreateAssessmentContent />
    </Suspense>
  );
}
