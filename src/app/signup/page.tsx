"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, User, AlertTriangle } from "lucide-react";

// ─── DynoQuizz SVG mark (reused from login) ──────────────────────────────────
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
      <motion.path
        d="M20 3L5 9v10c0 8.3 6.4 16 15 18 8.6-2 15-9.7 15-18V9L20 3z"
        fill="#165DFB"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
      />
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
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Conditional fields
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");

  // UI states
  const [agreed, setAgreed] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function validateForm(): boolean {
    const errs: Record<string, string> = {};
    if (name.trim().length < 3) errs.name = "Name must be at least 3 characters.";
    if (!email.includes("@")) errs.email = "Please enter a valid email address.";
    if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (password !== confirmPassword) errs.confirmPassword = "Passwords do not match.";
    if (!institution.trim()) errs.institution = "Institution is required.";
    if (role === "student" && !course.trim()) errs.course = "Course is required.";
    if (role === "teacher" && !department.trim()) errs.department = "Department is required.";
    if (!agreed) errs.agreed = "You must agree to the terms.";

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          institution,
          course: role === "student" ? course : undefined,
          department: role === "teacher" ? department : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.refresh();
        router.push(role === "teacher" ? "/dashboard/teacher" : "/dashboard/student");
      } else {
        setError(data.error || "Failed to create account.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const baseInput = (hasError?: boolean) =>
    `w-full rounded-[8.8px] border py-2.5 px-3 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium ${
      hasError ? "border-[#9c3535]/50 bg-[#fdebec]/40" : "border-[#d1dee8] bg-[#e6e3e2]/40"
    }`;

  const iconInput = (hasError?: boolean) =>
    `${baseInput(hasError)} pl-9`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-[#111111] p-4 py-10 font-sans selection:bg-[#e8f0ff] selection:text-[#165dfb] relative overflow-hidden">
      {/* Ambient shapes */}
      <div className="absolute top-1/4 right-1/4 h-80 w-80 rounded-full bg-[#165dfb]/4 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 h-64 w-64 rounded-full bg-[#eee9ff]/60 blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm">
        <motion.div
          variants={container}
          initial="hidden"
          animate={mounted ? "visible" : "hidden"}
          className="rounded-[8.8px] bg-white/40 backdrop-blur-xl p-7 border border-[#d1dee8]/50 text-left"
        >
          {/* Mark + heading */}
          <motion.div variants={item} className="flex flex-col items-center text-center mb-6">
            <Link href="/" className="mb-3.5">
              <DynoMark size={44} />
            </Link>
            <h1 className="text-xl font-extrabold -tracking-wide text-[#111111]">
              Create an account
            </h1>
            <p className="mt-0.5 text-xs text-[#78716b] font-medium">
              Get started with DynoQuizz today.
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
                onClick={() => { setRole(r); setValidationErrors({}); }}
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

          <form className="space-y-3.5" onSubmit={handleSignup}>
            {/* Full Name */}
            <motion.div variants={item} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Full Name</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={iconInput(!!validationErrors.name)}
                  placeholder="Alex Carter"
                  required
                />
              </div>
              {validationErrors.name && (
                <p className="text-[10px] text-[#9c3535] font-bold">{validationErrors.name}</p>
              )}
            </motion.div>

            {/* Email */}
            <motion.div variants={item} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Email Address</label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={iconInput(!!validationErrors.email)}
                  placeholder="you@university.edu"
                  required
                />
              </div>
              {validationErrors.email && (
                <p className="text-[10px] text-[#9c3535] font-bold">{validationErrors.email}</p>
              )}
            </motion.div>

            {/* Institution */}
            <motion.div variants={item} className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Institution</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className={baseInput(!!validationErrors.institution)}
                placeholder="e.g. Your University Name"
                required
              />
              {validationErrors.institution && (
                <p className="text-[10px] text-[#9c3535] font-bold">{validationErrors.institution}</p>
              )}
            </motion.div>

            {/* Role-conditional field */}
            {role === "student" ? (
              <motion.div variants={item} className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Course / Major</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  className={baseInput(!!validationErrors.course)}
                  placeholder="e.g. B.Sc Computer Science"
                  required
                />
                {validationErrors.course && (
                  <p className="text-[10px] text-[#9c3535] font-bold">{validationErrors.course}</p>
                )}
              </motion.div>
            ) : (
              <motion.div variants={item} className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={baseInput(!!validationErrors.department)}
                  placeholder="e.g. Department of Engineering"
                  required
                />
                {validationErrors.department && (
                  <p className="text-[10px] text-[#9c3535] font-bold">{validationErrors.department}</p>
                )}
              </motion.div>
            )}

            {/* Password row */}
            <motion.div variants={item}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Password</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={baseInput(!!validationErrors.password)}
                    placeholder="Min 8 chars"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#78716b]">Confirm</label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={baseInput(!!validationErrors.confirmPassword)}
                    placeholder="Re-type"
                    required
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="mt-1 text-[10px] font-bold text-[#78716b] hover:text-[#111111] cursor-pointer bg-transparent border-0"
              >
                {showPassword ? "Hide password" : "Show password"}
              </button>
              {(validationErrors.password || validationErrors.confirmPassword) && (
                <p className="text-[10px] text-[#9c3535] font-bold mt-1">
                  {validationErrors.password || validationErrors.confirmPassword}
                </p>
              )}
            </motion.div>

            {/* Terms */}
            <motion.div variants={item} className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#d1dee8] text-[#165dfb] focus:ring-[#165dfb] bg-[#e6e3e2]/30"
                />
                <span className="text-[10px] font-medium text-[#78716b] select-none leading-relaxed">
                  I agree to the Terms of Service and Privacy Policy.
                </span>
              </label>
              {validationErrors.agreed && (
                <p className="text-[10px] text-[#9c3535] font-bold mt-1">{validationErrors.agreed}</p>
              )}
            </motion.div>

            {/* Submit */}
            <motion.button
              variants={item}
              type="submit"
              disabled={loading}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="mt-2.5 flex w-full items-center justify-center rounded-[8.8px] bg-[#165dfb] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#165dfb]/90 transition-colors cursor-pointer disabled:opacity-50 border-0"
            >
              {loading ? "Registering…" : `Create ${role.charAt(0).toUpperCase() + role.slice(1)} Account`}
            </motion.button>
          </form>

          <motion.p variants={item} className="mt-4 text-center text-xs text-[#78716b] font-medium">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#165dfb] hover:underline">
              Log in here
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </main>
  );
}
