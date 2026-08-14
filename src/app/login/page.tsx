"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, AlertTriangle } from "lucide-react";

// ─── DynoQuizz SVG mark (shield + check) ─────────────────────────────────────
function DynoMark({ size = 40 }: { size?: number }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Shield body */}
      <motion.path
        d="M20 3L5 9v10c0 8.3 6.4 16 15 18 8.6-2 15-9.7 15-18V9L20 3z"
        fill="#165DFB"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
      />
      {/* Check mark */}
      <motion.path
        d="M13 20l5 5 9-9"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.7, ease: "easeOut" }}
      />
    </motion.svg>
  );
}

// ─── Stagger variants ─────────────────────────────────────────────────────────
const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role,
          name: email.split("@")[0].split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.refresh();
        router.push(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
      } else {
        setError(data.error || "Login failed. Please verify credentials.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-[8.8px] border py-2.5 pl-9 pr-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium ${
      hasError ? "border-[#9c3535]/50 bg-[#fdebec]/40" : "border-[#d1dee8] bg-[#e6e3e2]/40"
    }`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 font-sans selection:bg-[#e8f0ff] selection:text-[#165dfb] relative overflow-hidden">
      {/* Soft ambient shapes */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-[#165dfb]/4 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 h-64 w-64 rounded-full bg-[#eee9ff]/60 blur-3xl pointer-events-none" />

      {/* Auth panel */}
      <div className="w-full max-w-sm">
        <motion.div
          variants={container}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="rounded-[8.8px] bg-white/40 backdrop-blur-xl p-7 border border-[#d1dee8]/50 text-left"
        >
          {/* Logo mark + heading */}
          <motion.div variants={item} className="flex flex-col items-center text-center mb-6">
            <Link href="/" className="mb-3.5">
              <DynoMark size={44} />
            </Link>
            <h1 className="text-xl font-extrabold -tracking-wide text-[#111111]">
              Welcome back
            </h1>
            <p className="mt-0.5 text-xs text-[#78716b] font-medium">
              Sign in to your DynoQuizz account.
            </p>
          </motion.div>

          {/* Role switcher */}
          <motion.div
            variants={item}
            className="mb-5 flex rounded-[8.8px] bg-[#e6e3e2] p-1 border border-[#d1dee8]/50"
          >
            {(["student", "teacher"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`flex-1 py-1.5 text-xs font-bold transition-all rounded-[8.8px] cursor-pointer border-0 ${
                  role === r
                    ? "bg-white text-[#111111]"
                    : "text-[#78716b] hover:text-[#111111] bg-transparent"
                }`}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </motion.div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 flex items-center gap-2 rounded-[8.8px] bg-[#fdebec] border border-[#f5c6c6] p-3 text-xs text-[#9c3535] font-semibold"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Form */}
          <form className="space-y-4" onSubmit={handleLogin}>
            {/* Email */}
            <motion.div variants={item} className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                Email Address
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass()}
                  placeholder="you@university.edu"
                  required
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div variants={item} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
                  Password
                </label>
                <Link href="#" className="text-[10px] font-bold text-[#165dfb] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${inputClass()} pr-9`}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#78716b] hover:text-[#111111] cursor-pointer bg-transparent border-0"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2 flex w-full items-center justify-center rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#165dfb]/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              {loading ? "Signing In…" : `Sign In as ${role.charAt(0).toUpperCase() + role.slice(1)}`}
            </motion.button>
          </form>

          <motion.p variants={item} className="mt-5 text-center text-xs text-[#78716b] font-medium">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-bold text-[#165dfb] hover:underline">
              Sign up for free
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
}
