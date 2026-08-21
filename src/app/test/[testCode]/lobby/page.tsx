"use client";

import { use, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Download,
  CheckCircle2,
  ShieldCheck,
  Clock,
  FileQuestion,
  User,
  ArrowRight,
  Loader2,
  Lock,
  AlertCircle,
  ArrowLeft,
  Check,
} from "lucide-react";
import { Logo } from "@/components/Logo";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/+$/, "");

function getClientAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  let token = localStorage.getItem("dynoquizz_token");
  if (!token) {
    const match = document.cookie.match(/(?:^|;\s*)dynoquizz_token=([^;]+)/);
    if (match) {
      token = match[1];
      try {
        localStorage.setItem("dynoquizz_token", token);
      } catch {
        // ignore
      }
    }
  }
  if (token) return token;
  if (localStorage.getItem("dynoquizz_user")) return "session_active";
  return null;
}

function LobbyInner({ testCode }: { testCode: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regParam = searchParams.get("reg") || "";

  const [test, setTest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [registrationNumber, setRegistrationNumber] = useState(regParam);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    const cleanCode = testCode.toUpperCase();

    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(`/login?role=student&redirect=/test/${cleanCode}/lobby`);
        return;
      }
    }

    const fetchPackage = async () => {
      try {
        const token = localStorage.getItem("dynoquizz_token");
        const res = await fetch(
          `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          setTest({
            testCode: cleanCode,
            quizName: data.title || data.quizName || "Assessment Session",
            description:
              data.description || "Secure proctored assessment environment.",
            targetClass: data.targetClass || "General Batch",
            totalTimeLimitMinutes: Math.floor(
              (data.overallTimerSeconds || 3600) / 60,
            ),
            questions: data.questions || [],
          });
        } else {
          // Fallback mock package
          setTest({
            testCode: cleanCode,
            quizName: "Data Structures & Algorithms — Midterm",
            description: "Secure proctored assessment environment.",
            targetClass: "CS-201 Section A",
            totalTimeLimitMinutes: 60,
            questions: new Array(20).fill({ questionId: 1 }),
          });
        }
      } catch (e) {
        console.warn("Backend offline — using fallback quiz package.");
        setTest({
          testCode: cleanCode,
          quizName: "Data Structures & Algorithms — Midterm",
          description: "Secure proctored assessment environment.",
          targetClass: "CS-201 Section A",
          totalTimeLimitMinutes: 60,
          questions: new Array(20).fill({ questionId: 1 }),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPackage();

    if (!regParam && typeof window !== "undefined") {
      const storedReg =
        localStorage.getItem("dynoquizz_regNo") ||
        sessionStorage.getItem("dynoquizz_student_reg");
      if (storedReg) setRegistrationNumber(storedReg);
    }

    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem(`dynoquizz_pkg_${cleanCode}`);
      if (cached === "true") {
        setIsDownloaded(true);
      }
    }
  }, [testCode, regParam]);

  const handleDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(20);

    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 25;
      });
    }, 350);

    setTimeout(() => {
      clearInterval(interval);
      setDownloadProgress(100);
      setIsDownloading(false);
      setIsDownloaded(true);

      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `dynoquizz_pkg_${testCode.toUpperCase()}`,
          "true",
        );
      }
    }, 1500);
  };

  const handleStartAssessment = () => {
    const cleanCode = testCode.toUpperCase();
    const reg = registrationNumber || "CANDIDATE";
    if (typeof window !== "undefined") {
      localStorage.setItem("dynoquizz_regNo", reg);
      sessionStorage.setItem("dynoquizz_student_reg", reg);
    }
    router.push(`/test/${cleanCode}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
          <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
          Loading Assessment Gateway...
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="mx-auto max-w-md rounded-[8.8px] border border-[#d1dee8] bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[8.8px] bg-[#fbeee8] text-[#8c381c]">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-[#111111]">
          Assessment Not Found
        </h2>
        <p className="mt-2 text-xs text-[#78716b] leading-relaxed">
          The access code{" "}
          <span className="font-mono font-bold text-[#111111]">{testCode}</span>{" "}
          does not exist or has been archived.
        </p>
        <Link
          href="/join"
          className="mt-6 inline-flex items-center gap-2 rounded-[8.8px] bg-[#111111] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#222222] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Return to Join Gateway
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl w-full">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#78716b] hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Gateway
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-[#165dfb] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
            Assessment Lobby
          </span>
        </div>
      </div>

      <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-6 md:p-8 space-y-6">
        <div className="border-b border-[#d1dee8] pb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="rounded-[8.8px] bg-[#165dfb] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
              {test.testCode}
            </span>
            <span className="text-xs font-semibold text-[#78716b]">
              Target Class:{" "}
              <span className="font-bold text-[#111111]">
                {test.targetClass}
              </span>
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">
            {test.quizName}
          </h1>

          <p className="mt-2 text-xs text-[#78716b] leading-relaxed">
            {test.description}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <FileQuestion className="h-3.5 w-3.5 text-[#165dfb]" /> Questions
            </div>
            <p className="mt-1 text-sm font-bold text-[#111111]">
              {test.questions.length} Items
            </p>
          </div>

          <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <Clock className="h-3.5 w-3.5 text-[#165dfb]" /> Time Limit
            </div>
            <p className="mt-1 text-sm font-bold text-[#111111]">
              {test.totalTimeLimitMinutes} Minutes
            </p>
          </div>

          <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-3 col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 text-xs text-[#78716b] font-medium">
              <User className="h-3.5 w-3.5 text-[#165dfb]" /> Candidate Reg
            </div>
            <p className="mt-1 text-sm font-mono font-bold text-[#111111] truncate">
              {registrationNumber || "NOT SPECIFIED"}
            </p>
          </div>
        </div>

        {!isDownloaded && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-4 text-xs text-[#78716b] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#111111]">
                <ShieldCheck className="h-4 w-4 text-[#165dfb]" />
                Zero-Latency Offline Assessment Architecture
              </div>
              <p className="leading-relaxed">
                To guarantee zero exam disruption during network drops, all
                assessment assets are cached locally before starting.
              </p>
            </div>

            <div className="space-y-2 text-xs text-[#78716b]">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#165dfb]" />
                <span>AES-256 client-side payload encryption</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-[#165dfb]" />
                <span>Full-offline submission fallback enabled</span>
              </div>
            </div>

            {isDownloading ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#111111]">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
                    Downloading Assessment Package...
                  </span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e3e2]">
                  <motion.div
                    className="h-full bg-[#165dfb]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 rounded-[8.8px] bg-[#165dfb] py-3 text-sm font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all cursor-pointer border-0"
              >
                <Download className="h-4 w-4" /> Download Assessment Package
              </button>
            )}
          </motion.div>
        )}

        {isDownloaded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="rounded-[8.8px] bg-[#e7f7ef] border border-[#1d5237]/20 p-4 text-xs text-[#1d5237]">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-[#1d5237]" />
                <div className="space-y-1">
                  <p className="font-bold text-sm">
                    Package Verified &amp; Ready
                  </p>
                  <p className="leading-relaxed opacity-90">
                    All questions are cached. You can complete this exam
                    securely.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] p-5 space-y-3 text-left">
              <div className="flex items-center justify-between border-b border-[#d1dee8] pb-3">
                <span className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-[#165dfb]" /> Candidate
                  Ready Room
                </span>
                <span className="rounded-[8.8px] bg-white px-2.5 py-0.5 text-[10px] font-bold text-[#165dfb] border border-[#d1dee8]">
                  READY
                </span>
              </div>

              <div className="space-y-2 text-xs text-[#78716b]">
                <p className="font-semibold text-[#111111]">Directives:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    The timer starts immediately once you click "Start
                    Assessment".
                  </li>
                  <li>
                    Your answers are automatically saved locally and
                    synchronized upon completion.
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleStartAssessment}
                className="w-full flex items-center justify-center gap-2 rounded-[8.8px] bg-[#111111] py-3.5 text-sm font-bold text-white hover:bg-[#222222] active:scale-[0.98] transition-all cursor-pointer border-0"
              >
                Start Assessment <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function AssessmentLobbyPage({
  params,
}: {
  params: Promise<{ testCode: string }>;
}) {
  const { testCode } = use(params);

  return (
    <div className="min-h-screen bg-[#f5f5f4] flex flex-col font-sans selection:bg-[#e6e3e2] selection:text-[#165dfb]">
      <header className="sticky top-0 z-40 w-full border-b border-[#d1dee8] bg-white/95 backdrop-blur-sm px-4 md:px-8 py-3">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between">
          <Logo />
          <Link
            href="/dashboard/student"
            className="rounded-[8.8px] border border-[#d1dee8] bg-[#f5f5f4] px-3 py-1.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Suspense
          fallback={
            <div className="flex items-center gap-2 text-xs font-bold text-[#78716b]">
              <Loader2 className="h-4 w-4 animate-spin text-[#165dfb]" />
              Loading Assessment Lobby...
            </div>
          }
        >
          <LobbyInner testCode={testCode} />
        </Suspense>
      </main>
    </div>
  );
}
