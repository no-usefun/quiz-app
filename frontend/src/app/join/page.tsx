"use client";
// join/page.tsx
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  Loader2,
} from "lucide-react";

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

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCode = searchParams.get("code") || "";

  const [testCode, setTestCode] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (queryCode) {
      setTestCode(queryCode.toUpperCase());
    }
    if (typeof window !== "undefined") {
      const token = getClientAuthToken();
      if (!token) {
        router.push(
          `/login?role=student&redirect=/join${queryCode ? `?code=${queryCode}` : ""}`,
        );
        return;
      }
      let userObj: any = null;
      try {
        const rawUser = localStorage.getItem("dynoquizz_user");
        if (rawUser) userObj = JSON.parse(rawUser);
      } catch {}
      const stored = userObj?.registrationNo || localStorage.getItem("dynoquizz_regNo");
      if (stored) setRegistrationNo(stored);
    }
  }, [queryCode, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = testCode.trim().toUpperCase();
    const cleanReg = registrationNo.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 2) {
      setError("Please enter a valid assessment code.");
      return;
    }

    if (!cleanReg) {
      setError("Please enter your Student Registration / Roll Number.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("dynoquizz_token");

      const pkgUrl = `${API_BASE}/api/v1/quizzes/code/${cleanCode}/package`;

      // Ping the live backend to see if this quiz exists
      const res = await fetch(pkgUrl, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
      });

      if (res.status === 404) {
        setError(
          `Assessment session code "${cleanCode}" was not found. Please verify the code.`,
        );
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "(unreadable body)");
        let bodyJson: any = null;
        try {
          bodyJson = JSON.parse(bodyText);
        } catch {
          /* not JSON */
        }
        const serverMsg =
          bodyJson?.message ||
          bodyJson?.error ||
          bodyText.slice(0, 200);

        if (
          typeof serverMsg === "string" &&
          serverMsg.toLowerCase().includes("not available to students")
        ) {
          setError(
            "This assessment is not open yet. Ask your teacher to publish it.",
          );
          setLoading(false);
          return;
        }

        if (
          res.status === 409 &&
          (bodyJson?.error === "QUIZ_NOT_ACTIVE" ||
            (typeof serverMsg === "string" &&
              serverMsg.includes("QUIZ_NOT_ACTIVE")))
        ) {
          setError("This assessment is not open right now.");
          setLoading(false);
          return;
        }

        setError(serverMsg || `Server returned status: ${res.status}`);
        setLoading(false);
        return;
      }

      // Save Student Registration info
      if (typeof window !== "undefined") {
        localStorage.setItem("dynoquizz_regNo", cleanReg);
        sessionStorage.setItem("dynoquizz_student_reg", cleanReg);
      }

      // Route directly to the new LOBBY page to initialize the attempt
      router.push(`/test/${cleanCode}/lobby`);
    } catch (err: any) {
      console.error("Join validation error:", err);
      const msg = err.message || "";
      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("not available to students")
      ) {
        setError(
          "This assessment is not open yet. Ask your teacher to publish it.",
        );
      } else if (
        typeof msg === "string" &&
        msg.includes("QUIZ_NOT_ACTIVE")
      ) {
        setError("This assessment is not open right now.");
      } else {
        setError(
          msg ||
            "An error occurred while connecting to the assessment server. Please check your network.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
          Assessment Access Code
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray/70">
            <KeyRound className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={testCode}
            onChange={(e) => {
              setTestCode(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 849201"
            maxLength={10}
            className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3.5 pl-10 pr-3 text-center font-mono text-xl font-black tracking-[0.2em] text-midnight-navy outline-none transition-all placeholder:font-sans placeholder:text-xs placeholder:font-medium placeholder:tracking-normal placeholder:text-steel-blue-gray/50 hover:border-mist-blue/70 focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15"
            required
          />
        </div>
        <p className="text-[10.5px] text-steel-blue-gray/80 font-medium pl-0.5">
          Provided by your instructor for this session
        </p>
      </div>

      <div className="space-y-1.5 text-left">
        <label className="text-[10px] font-bold uppercase tracking-wider text-steel-blue-gray block">
          Student Registration / Roll Number
        </label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-steel-blue-gray/70">
            <UserCheck className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={registrationNo}
            onChange={(e) => {
              setRegistrationNo(e.target.value.toUpperCase());
              setError(null);
            }}
            placeholder="e.g. 21BCE1024"
            maxLength={20}
            className="w-full rounded-inputs border border-mist-blue bg-frost-surface py-3 pl-10 pr-3 text-xs font-bold uppercase text-midnight-navy outline-none transition-all placeholder:text-steel-blue-gray/50 hover:border-mist-blue/70 focus:border-signal-green focus:bg-white focus:ring-4 focus:ring-signal-green/15"
            required
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-inputs border border-pastel-pink-text/25 bg-pastel-pink/20 p-3 text-left"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-px text-pastel-pink-text" />
          <p className="text-xs font-bold leading-relaxed text-pastel-pink-text">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-center gap-2 rounded-buttons bg-signal-green px-4 py-3 text-xs font-bold text-white shadow-lg shadow-signal-green/25 transition-all duration-200 hover:bg-signal-green/90 hover:shadow-signal-green/35 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none cursor-pointer border-0"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying Session...
          </>
        ) : (
          <>
            Join Assessment
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
    </form>
  );
}

export default function JoinPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-frost-surface text-midnight-navy p-4 font-sans selection:bg-frost-surface selection:text-signal-green overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(22,93,251,0.06), transparent 55%)",
        }}
      />

      <span className="absolute left-1/2 top-6 z-10 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold tracking-tight text-midnight-navy shadow-sm ring-1 ring-black/5 backdrop-blur">
        Quizly
      </span>

      <motion.div
        initial={mounted ? { opacity: 0, y: 8 } : false}
        animate={mounted ? { opacity: 1, y: 0 } : false}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-cards bg-paper-white p-6 md:p-8 border border-mist-blue shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] text-left"
      >
        <div className="flex justify-start mb-6 text-left">
          <Link
            href="/dashboard/student"
            className="group inline-flex items-center text-xs font-bold text-steel-blue-gray hover:text-midnight-navy transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />{" "}
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-7 flex flex-col items-center justify-center text-center">
          <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
            <span
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-signal-green/25 blur-lg animate-pulse"
            />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-signal-green to-[#0e7a53] text-white shadow-lg shadow-signal-green/30 ring-1 ring-signal-green/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-signal-green block mb-1.5">
            Student Gate
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-midnight-navy">
            Join Assessment
          </h1>
          <p className="mt-1.5 max-w-xs text-xs text-steel-blue-gray leading-relaxed font-medium">
            Enter the test code provided by your instructor to begin identity
            verification.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-2 text-xs text-steel-blue-gray font-medium text-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading code entry...
            </div>
          }
        >
          <JoinForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
