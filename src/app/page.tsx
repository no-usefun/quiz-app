"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useInView,
} from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  Eye,
  Timer,
  Zap,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Lock,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  QrCode,
  FileQuestion,
  Wifi,
  WifiOff,
  Copy,
  MonitorStop,
  Clipboard,
  Fullscreen,
  UserRound,
  Brain,
  FileBarChart2,
  Layers,
  Scan,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useSession } from "@/hooks/useSession";
import { WaveText } from "@/components/WaveText";

// ─── Design tokens (inline for zero-class-collision safety) ──────────────────
const C = {
  ink: "#111111",
  fog: "#78716b",
  ice: "#d1dee8",
  cobalt: "#165dfb",
  paper: "#f5f5f4",
  chalk: "#e6e3e2",
  blue: "#e8f0ff",
  lavender: "#eee9ff",
  mint: "#e7f7ef",
  peach: "#fff0e8",
  yellow: "#fff8d9",
  rose: "#fdebec",
};

// ─── Shared section scroll animation variant ─────────────────────────────────
const sectionVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const staggerContainer = (stagger = 0.1, delay = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

const childUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const } },
};

const childLeft = {
  hidden: { opacity: 0, x: -60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

const childRight = {
  hidden: { opacity: 0, x: 60 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

// ─── Assessment categories for infinite marquee ───────────────────────────────
const CATEGORIES = [
  "Universities",
  "Training Programs",
  "Academic Evaluations",
  "Certification Tests",
  "Classroom Assessments",
  "Technical Interviews",
  "Remote Assessments",
  "Corporate Training",
  "Entrance Examinations",
  "Professional Licensing",
];

// ─── Stage slider data ────────────────────────────────────────────────────────
const STAGES = [
  {
    id: "create",
    label: "01  Create",
    title: "Configure & Import",
    desc: "Instructors build assessment banks via CSV import and configure timing, grading, and disclosure rules.",
    bg: C.blue,
  },
  {
    id: "verify",
    label: "02  Verify",
    title: "Secure Checkpoints",
    desc: "Candidates complete browser verification — face mapping, fullscreen enforcement, and extension checks.",
    bg: C.mint,
  },
  {
    id: "assess",
    label: "03  Assess",
    title: "Synchronized Arena",
    desc: "Dynamic time pacing locks selected answers when timers elapse, synchronizing the entire cohort.",
    bg: C.lavender,
  },
  {
    id: "monitor",
    label: "04  Monitor",
    title: "Supervisor Streams",
    desc: "Live progress, connection health, and security violations are streamed to the teacher console instantly.",
    bg: C.peach,
  },
  {
    id: "analyze",
    label: "05  Analyze",
    title: "Score Evaluation",
    desc: "Incident audits calculate penalty factors, and release evaluated gradecards to student histories.",
    bg: C.yellow,
  },
];

// ─── Problem cards ───────────────────────────────────────────────────────────
const PROBLEMS = [
  { icon: MonitorStop, title: "Tab Switching", desc: "Candidates silently switch to answer-sharing tabs.", from: "left" },
  { icon: Clipboard, title: "Clipboard Abuse", desc: "Copy-paste exploits bypass question comprehension.", from: "bottom" },
  { icon: Fullscreen, title: "Fullscreen Exit", desc: "Exiting secure view allows external tool access.", from: "right" },
  { icon: WifiOff, title: "Network Drops", desc: "Connection loss mid-exam discards in-progress work.", from: "left" },
  { icon: UserRound, title: "Answer Sharing", desc: "Slow submission patterns signal collusion networks.", from: "bottom" },
  { icon: BarChart3, title: "No Live Vision", desc: "Teachers see nothing until final grades are submitted.", from: "right" },
];

// ─── Capability cards ────────────────────────────────────────────────────────
const CAPABILITIES = [
  { icon: Eye, label: "Face Verification", bg: C.blue, accent: C.cobalt, pill: "Active" },
  { icon: Brain, label: "Eye & Head Tracking", bg: C.lavender, accent: "#7c5cbf", pill: "Calibrating" },
  { icon: MonitorStop, label: "Tab Monitoring", bg: C.peach, accent: "#b05430", pill: "Watching" },
  { icon: Clipboard, label: "Clipboard Protection", bg: C.mint, accent: "#1d6b42", pill: "Locked" },
  { icon: Fullscreen, label: "Fullscreen Enforcement", bg: C.yellow, accent: "#8a6a10", pill: "Enforced" },
  { icon: Wifi, label: "Offline-First Mode", bg: C.blue, accent: C.cobalt, pill: "Ready" },
  { icon: Timer, label: "Dynamic Time Scoring", bg: C.lavender, accent: "#7c5cbf", pill: "Live" },
  { icon: BarChart3, label: "Live Teacher Monitor", bg: C.peach, accent: "#b05430", pill: "Streaming" },
  { icon: ShieldCheck, label: "Integrity Flags", bg: C.rose, accent: "#9c3535", pill: "Flagged" },
  { icon: FileBarChart2, label: "Analytics Reports", bg: C.mint, accent: "#1d6b42", pill: "Generated" },
  { icon: Layers, label: "Multi-Session Support", bg: C.yellow, accent: "#8a6a10", pill: "Active" },
  { icon: Lock, label: "Proctored Submits", bg: C.blue, accent: C.cobalt, pill: "Sealed" },
];

// ─── Proctoring simulator ─────────────────────────────────────────────────────
const PROCTOR_CHECKS = [
  { label: "Face detected", ok: true },
  { label: "Fullscreen locked", ok: true },
  { label: "Tab activity clean", ok: true },
  { label: "Clipboard protected", ok: true },
  { label: "Unusual head movement", ok: false },
];

function ProctoringMonitor() {
  const [step, setStep] = useState(0);
  const [integrity, setIntegrity] = useState(98);

  useEffect(() => {
    const t = setInterval(() => {
      setStep((p) => (p + 1) % 6);
    }, 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setIntegrity(step === 4 || step === 5 ? 72 : 98);
  }, [step]);

  return (
    <div className="rounded-[8.8px] border border-[#d1dee8] bg-white overflow-hidden">
      {/* Simulated camera frame */}
      <div
        className="relative h-44 w-full overflow-hidden"
        style={{ background: "#0a0d14" }}
      >
        {/* Scanning line */}
        <div
          className="animate-scan absolute left-0 w-full h-0.5 pointer-events-none"
          style={{ background: `linear-gradient(90deg, transparent, ${C.cobalt}88, transparent)` }}
        />
        {/* Face outline simulation */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Head oval */}
            <div
              className="h-20 w-16 rounded-full border-2 opacity-70"
              style={{ borderColor: step === 4 || step === 5 ? "#ef4444" : C.cobalt }}
            />
            {/* Eye tracking dots */}
            <div className="absolute top-5 left-3 h-1.5 w-1.5 rounded-full animate-blink" style={{ background: C.cobalt }} />
            <div className="absolute top-5 right-3 h-1.5 w-1.5 rounded-full animate-blink" style={{ background: C.cobalt }} />
            {/* Corner tracking corners */}
            <div className="absolute -top-2 -left-2 h-3 w-3 border-l-2 border-t-2 opacity-80" style={{ borderColor: C.cobalt }} />
            <div className="absolute -top-2 -right-2 h-3 w-3 border-r-2 border-t-2 opacity-80" style={{ borderColor: C.cobalt }} />
            <div className="absolute -bottom-2 -left-2 h-3 w-3 border-l-2 border-b-2 opacity-80" style={{ borderColor: C.cobalt }} />
            <div className="absolute -bottom-2 -right-2 h-3 w-3 border-r-2 border-b-2 opacity-80" style={{ borderColor: C.cobalt }} />
          </div>
        </div>
        {/* Status label overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: "rgba(0,0,0,0.6)" }}>
            BIOMETRIC MONITOR
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold"
            style={{
              background: step === 4 || step === 5 ? "#ef444433" : `${C.cobalt}33`,
              color: step === 4 || step === 5 ? "#ef4444" : C.cobalt,
            }}
          >
            {step === 4 || step === 5 ? "⚠ ALERT" : "● LIVE"}
          </span>
        </div>
      </div>

      {/* Engine status */}
      <div className="p-3 space-y-1.5 bg-[#f5f5f4]">
        <div className="flex items-center justify-between border-b border-[#d1dee8]/40 pb-2 mb-2">
          <span className="text-[9px] font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-3 w-3 text-[#165dfb]" /> PROCTOR ENGINE
          </span>
          <span className="font-mono text-[10px] font-bold" style={{ color: integrity < 90 ? "#ef4444" : C.cobalt }}>
            {integrity}% integrity
          </span>
        </div>
        {PROCTOR_CHECKS.map((check, idx) => {
          const isActive = step === idx;
          const flagged = !check.ok && isActive;
          return (
            <div
              key={check.label}
              className="flex justify-between items-center text-[10px] font-medium rounded px-1.5 py-0.5 transition-colors"
              style={{
                background: flagged ? "#fdebec" : isActive ? C.blue : "transparent",
                color: flagged ? "#9c3535" : "#78716b",
              }}
            >
              <span>{check.label}</span>
              <span className="font-bold" style={{ color: flagged ? "#9c3535" : check.ok ? "#1d6b42" : "#78716b" }}>
                {flagged ? "⚠ Flagged" : "✓ Active"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Live telemetry dashboard ─────────────────────────────────────────────────
interface Candidate {
  id: string;
  name: string;
  score: number;
  progress: number;
  status: "Active" | "Submitted" | "Flagged" | "Joined";
  flags: number;
}

function LiveTelemetry() {
  const [tick, setTick] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([
    { id: "c1", name: "Candidate 01", score: 94, progress: 80, status: "Active", flags: 0 },
    { id: "c2", name: "Candidate 02", score: 88, progress: 65, status: "Active", flags: 0 },
    { id: "c3", name: "Candidate 03", score: 81, progress: 40, status: "Active", flags: 0 },
  ]);
  const [alert, setAlert] = useState<string | null>(null);
  const [activeCount, setActiveCount] = useState(42);

  useEffect(() => {
    const t = setInterval(() => setTick((p) => (p + 1) % 7), 3600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (tick === 0) {
      setCandidates([
        { id: "c1", name: "Candidate 01", score: 94, progress: 80, status: "Active", flags: 0 },
        { id: "c2", name: "Candidate 02", score: 88, progress: 65, status: "Active", flags: 0 },
        { id: "c3", name: "Candidate 03", score: 81, progress: 40, status: "Active", flags: 0 },
      ]);
      setAlert(null);
      setActiveCount(42);
    } else if (tick === 1) {
      // Candidate 04 joins
      setCandidates((p) => [
        ...p,
        { id: "c4", name: "Candidate 04", score: 0, progress: 3, status: "Joined", flags: 0 },
      ]);
      setActiveCount(43);
      setAlert("Candidate 04 joined the session");
    } else if (tick === 2) {
      // Candidate 02 progress jumps to 91%
      setCandidates((p) =>
        p.map((c) => (c.id === "c2" ? { ...c, progress: 91, score: 91 } : c))
      );
      setAlert(null);
    } else if (tick === 3) {
      // Candidate 04 active and scoring
      setCandidates((p) =>
        p.map((c) => (c.id === "c4" ? { ...c, progress: 28, score: 76, status: "Active" } : c))
      );
    } else if (tick === 4) {
      // Sort by score DESC — ranks shuffle
      setCandidates((p) => [...p].sort((a, b) => b.score - a.score));
      setAlert("Leaderboard reranked — Candidate 02 takes lead");
    } else if (tick === 5) {
      // Candidate 07 tab switch flag
      setCandidates((p) => [
        ...p,
        { id: "c7", name: "Candidate 07", score: 67, progress: 48, status: "Flagged", flags: 1 },
      ]);
      setAlert("⚠ Tab switch detected — Candidate 07");
    } else if (tick === 6) {
      setAlert(null);
    }
  }, [tick]);

  return (
    <motion.div
      whileHover={{ scale: 1.005, transition: { duration: 0.2 } }}
      className="w-full rounded-[8.8px] border border-[#d1dee8] bg-white overflow-hidden"
    >
      {/* Console header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#d1dee8]/50 bg-[#f5f5f4]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: C.cobalt }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: C.cobalt }} />
          </span>
          <span className="text-[10px] font-bold text-[#111111] uppercase tracking-widest">
            Live Teacher Console — Session CS-302
          </span>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[9px] font-bold border"
          style={{ background: C.mint, borderColor: "#c0e8d0", color: "#1d6b42" }}
        >
          {activeCount} Online
        </span>
      </div>

      {/* Alert banner */}
      <div className="h-8 relative overflow-hidden border-b border-[#d1dee8]/30">
        <AnimatePresence mode="wait">
          {alert && (
            <motion.div
              key={alert}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute inset-0 flex items-center px-5 gap-2 text-[10px] font-bold"
              style={{
                background: alert.startsWith("⚠") ? C.rose : C.blue,
                color: alert.startsWith("⚠") ? "#9c3535" : C.cobalt,
              }}
            >
              {alert.startsWith("⚠") && <AlertTriangle className="h-3 w-3 shrink-0" />}
              {alert}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Candidate rows */}
      <div className="divide-y divide-[#d1dee8]/40">
        <AnimatePresence initial={false}>
          {candidates.map((c) => {
            const flagged = c.status === "Flagged";
            const submitted = c.status === "Submitted";
            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                whileHover={{ backgroundColor: "#f5f5f4" }}
                className="flex items-center justify-between px-5 py-3.5 transition-colors"
                style={{
                  background: flagged ? C.rose : undefined,
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: flagged ? "#9c3535" : C.cobalt }}
                  >
                    {c.name.split(" ")[1]}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-[#111111]">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: C.ice }}>
                        <div
                          className="h-full transition-all duration-700"
                          style={{ width: `${c.progress}%`, background: flagged ? "#9c3535" : C.cobalt }}
                        />
                      </div>
                      <span className="text-[8px] font-mono text-[#78716b]">{c.progress}%</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold tabular-nums" style={{ color: C.ink }}>{c.score}%</p>
                  <p
                    className="text-[8px] font-bold uppercase"
                    style={{ color: flagged ? "#9c3535" : submitted ? C.cobalt : "#78716b" }}
                  >
                    {flagged ? "⚠ Flagged" : c.status}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Score decay timer ────────────────────────────────────────────────────────
function ScoreDecayWidget() {
  const [t, setT] = useState(30);
  useEffect(() => {
    const i = setInterval(() => setT((p) => (p > 0 ? p - 1 : 30)), 1000);
    return () => clearInterval(i);
  }, []);
  const pct = (t / 30) * 100;
  const score = Math.round(70 + (t / 30) * 30);

  return (
    <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 space-y-3">
      <span className="text-[9px] font-bold text-[#78716b] uppercase tracking-wider">Dynamic Pacing Score</span>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: C.chalk }}>
        <div
          className="h-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: C.cobalt }}
        />
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="font-bold" style={{ color: C.ink }}>{t}s left</span>
        <span className="font-bold" style={{ color: C.cobalt }}>{score}% value</span>
      </div>
    </div>
  );
}

// ─── Join code widget ─────────────────────────────────────────────────────────
function JoinCodeWidget() {
  return (
    <div className="rounded-[8.8px] border border-[#d1dee8] bg-white p-4 text-center space-y-2">
      <span className="text-[9px] font-bold text-[#78716b] uppercase tracking-wider block">Join Assessment</span>
      <div
        className="font-mono text-lg font-black rounded-[8.8px] py-2 px-4 tracking-widest border"
        style={{ background: C.blue, borderColor: "#c5d8f7", color: C.cobalt }}
      >
        A7K92P
      </div>
      <div className="flex justify-center" style={{ color: C.fog }}>
        <QrCode className="h-10 w-10 opacity-40" />
      </div>
      <span className="text-[9px] text-[#78716b] font-medium">Or scan QR code</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { user } = useSession();
  const [mounted, setMounted] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const sliderTimer = useRef<NodeJS.Timeout | null>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -70]);
  const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    sliderTimer.current = setInterval(() => {
      setActiveSlide((p) => (p + 1) % STAGES.length);
    }, 4800);
    return () => { if (sliderTimer.current) clearInterval(sliderTimer.current); };
  }, [autoplay]);

  // Shared viewport motion props
  const vp = { once: true, amount: 0.2 as const };

  return (
    <main
      className="min-h-screen font-sans overflow-x-hidden"
      style={{ background: C.paper, color: C.ink }}
    >
      {/* ─── Sticky Navigation ─────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 w-full border-b backdrop-blur-md"
        style={{ background: "rgba(245,245,244,0.88)", borderColor: C.ice }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-xs font-bold" style={{ color: C.fog }}>
            <Link href="#problem" className="hover:text-[#111111] transition-colors">Why DynoQuizz</Link>
            <Link href="#proctoring" className="hover:text-[#111111] transition-colors">AI Proctoring</Link>
            <Link href="#telemetry" className="hover:text-[#111111] transition-colors">Live Monitor</Link>
            <Link href="#workflow" className="hover:text-[#111111] transition-colors">Workflow</Link>
          </nav>
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                href={user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"}
                className="flex items-center gap-1.5 rounded-[8.8px] px-4 py-2 text-xs font-bold text-white border-0 transition-colors"
                style={{ background: C.cobalt }}
              >
                Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-xs font-bold px-3 py-1.5 transition-colors" style={{ color: C.fog }}>
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-1.5 rounded-[8.8px] px-4 py-2 text-xs font-bold text-white border-0 transition-colors"
                  style={{ background: C.cobalt }}
                >
                  Get Started <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <motion.section
        style={mounted ? { y: heroY, opacity: heroOpacity } : {}}
        className="relative flex flex-col items-center justify-center px-6 pt-28 pb-20 text-center max-w-5xl mx-auto z-10"
      >
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-5 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold border"
          style={{ background: C.blue, borderColor: "#c5d8f7", color: C.cobalt }}
        >
          <Sparkles className="h-3 w-3" /> Offline-First  ·  AI-Proctored  ·  Real-Time
        </motion.div>

        {/* Main heading — WaveText word-by-word */}
        <h1 className="max-w-4xl text-4xl sm:text-6xl font-extrabold leading-tight -tracking-wide" style={{ color: C.ink }}>
          <WaveText text="Secure. Fair. AI-Proctored Assessments." stagger={0.07} />
        </h1>

        {/* Sub-heading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed font-medium"
          style={{ color: C.fog }}
        >
          DynoQuizz runs offline-ready assessments with local edge AI, biometric face verification,
          movement monitoring, and anti-cheat detection — all synced live to the teacher console.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-8 flex flex-col sm:flex-row items-center gap-3"
        >
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-[8.8px] px-6 py-3 text-xs font-bold text-white border-0 transition-colors hover:opacity-90"
            style={{ background: C.cobalt }}
          >
            Start Free Trial <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/join"
            className="flex items-center gap-2 rounded-[8.8px] border px-6 py-3 text-xs font-bold transition-all hover:bg-[#e6e3e2]/40"
            style={{ borderColor: C.ice, color: C.ink, background: "white" }}
          >
            Enter Session Code
          </Link>
        </motion.div>

        {/* Status strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold"
          style={{ color: C.fog }}
        >
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full animate-blink" style={{ background: "#1d6b42" }} />
            System Operational
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#1d6b42]" />
            Offline-Ready
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: C.cobalt }} />
            Edge-AI Active
          </span>
        </motion.div>
      </motion.section>

      {/* ─── The Problem ────────────────────────────────────────────────── */}
      <section
        id="problem"
        className="py-24 px-6 border-t"
        style={{ background: C.blue, borderColor: C.ice }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={staggerContainer(0.08)}
            className="text-center mb-14"
          >
            <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
              The Challenge
            </motion.span>
            <motion.h2 variants={childUp} className="text-3xl sm:text-4xl font-extrabold -tracking-wide max-w-3xl mx-auto" style={{ color: C.ink }}>
              <WaveText text="Online assessments are easy to compromise." />
            </motion.h2>
            <motion.p variants={childUp} className="mt-4 text-sm font-medium max-w-xl mx-auto" style={{ color: C.fog }}>
              Standard exam environments give supervisors almost no visibility into what candidates actually do during the test.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={staggerContainer(0.1)}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {PROBLEMS.map(({ icon: Icon, title, desc, from }) => {
              const variant = from === "left" ? childLeft : from === "right" ? childRight : childUp;
              return (
                <motion.div
                  key={title}
                  variants={variant}
                  className="rounded-[8.8px] border p-5 flex gap-4 items-start"
                  style={{ background: "white", borderColor: C.ice }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                >
                  <div
                    className="h-9 w-9 rounded-[8.8px] flex items-center justify-center shrink-0 border"
                    style={{ background: C.rose, borderColor: "#f5c6c6" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "#9c3535" }} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold mb-0.5" style={{ color: C.ink }}>{title}</h3>
                    <p className="text-[11px] font-medium leading-relaxed" style={{ color: C.fog }}>{desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={sectionVariants}
            className="mt-12 text-center"
          >
            <div
              className="inline-flex items-center gap-2 rounded-[8.8px] border px-5 py-3 text-xs font-bold"
              style={{ background: "white", borderColor: C.ice, color: C.cobalt }}
            >
              <CheckCircle2 className="h-4 w-4" />
              DynoQuizz brings assessment, integrity, and intelligence into a single platform.
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── AI Proctoring — Major Visual Section ───────────────────────── */}
      <section
        id="proctoring"
        className="py-24 px-6 border-t overflow-hidden"
        style={{ background: C.paper, borderColor: C.ice }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Heading */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={staggerContainer(0.1)}
            className="text-center mb-16"
          >
            <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
              AI Proctoring
            </motion.span>
            <motion.h2 variants={childUp} className="text-3xl sm:text-4xl font-extrabold -tracking-wide max-w-3xl mx-auto" style={{ color: C.ink }}>
              <WaveText text="Your assessment has eyes on the important moments." stagger={0.06} />
            </motion.h2>
            <motion.p variants={childUp} className="mt-4 text-sm font-medium max-w-xl mx-auto" style={{ color: C.fog }}>
              Local edge routines detect tab changes, fullscreen exits, clipboard events, head movement, and multiple faces — instantly, without heavy data transfer.
            </motion.p>
          </motion.div>

          {/* Asymmetric 3-card composition */}
          <div className="relative flex items-center justify-center min-h-[520px]">
            {/* Left side card (clipped, rotated) */}
            <motion.div
              initial={{ opacity: 0, x: -80, rotate: -5 }}
              whileInView={{ opacity: 1, x: 0, rotate: -5 }}
              viewport={vp}
              whileHover={{ rotate: 0, y: -8, scale: 1.02, transition: { duration: 0.25 } }}
              className="absolute left-0 lg:-left-8 w-64 rounded-[8.8px] border p-5 cursor-pointer z-0 hidden lg:flex flex-col gap-4"
              style={{ background: C.mint, borderColor: "#c0e8d0", top: "50px" }}
            >
              <div
                className="h-8 w-8 rounded-[8.8px] flex items-center justify-center border"
                style={{ background: "white", borderColor: C.ice }}
              >
                <Lock className="h-4 w-4" style={{ color: C.cobalt }} />
              </div>
              <h3 className="text-xs font-extrabold -tracking-wide" style={{ color: C.ink }}>Instant Code Join</h3>
              <JoinCodeWidget />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#1d6b42" }}>Frictionless Entry</span>
            </motion.div>

            {/* Center card (dominant) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={vp}
              whileHover={{ scale: 1.01, transition: { duration: 0.2 } }}
              className="relative z-10 w-full max-w-md rounded-[8.8px] border-2 p-6 flex flex-col gap-4"
              style={{ background: "white", borderColor: C.cobalt }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="h-9 w-9 rounded-[8.8px] flex items-center justify-center border"
                  style={{ background: C.blue, borderColor: "#c5d8f7" }}
                >
                  <Eye className="h-4.5 w-4.5" style={{ color: C.cobalt }} />
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: C.cobalt }}
                >
                  Core Feature
                </span>
              </div>
              <h3 className="text-sm font-extrabold -tracking-wide" style={{ color: C.ink }}>Edge-AI Proctoring</h3>
              <p className="text-xs font-medium leading-relaxed" style={{ color: C.fog }}>
                Locally-running browser routines monitor camera feeds, detect suspicious motion, and flag integrity events with zero server round-trips.
              </p>
              <ProctoringMonitor />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.cobalt }}>Integrity Shield</span>
            </motion.div>

            {/* Right side card (clipped, rotated) */}
            <motion.div
              initial={{ opacity: 0, x: 80, rotate: 5 }}
              whileInView={{ opacity: 1, x: 0, rotate: 5 }}
              viewport={vp}
              whileHover={{ rotate: 0, y: -8, scale: 1.02, transition: { duration: 0.25 } }}
              className="absolute right-0 lg:-right-8 w-64 rounded-[8.8px] border p-5 cursor-pointer z-0 hidden lg:flex flex-col gap-4"
              style={{ background: C.lavender, borderColor: "#d8d0f0", top: "50px" }}
            >
              <div
                className="h-8 w-8 rounded-[8.8px] flex items-center justify-center border"
                style={{ background: "white", borderColor: C.ice }}
              >
                <Timer className="h-4 w-4" style={{ color: C.cobalt }} />
              </div>
              <h3 className="text-xs font-extrabold -tracking-wide" style={{ color: C.ink }}>Dynamic Time Scoring</h3>
              <ScoreDecayWidget />
              <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#7c5cbf" }}>Cognitive Velocity</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── How Integrity Works (horizontal timeline) ───────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={sectionVariants}
        className="py-24 px-6 border-t"
        style={{ background: C.lavender, borderColor: C.ice }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
            Integrity System
          </span>
          <h2 className="text-3xl font-extrabold -tracking-wide mb-12" style={{ color: C.ink }}>
            How every flag becomes an action.
          </h2>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {[
              { n: "01", label: "Incident Detected", desc: "Tab switch, head movement, or fullscreen exit triggers the edge engine." },
              { n: "02", label: "Flag Logged", desc: "Event is timestamped and attached to the candidate's integrity record." },
              { n: "03", label: "Teacher Alerted", desc: "Real-time notification appears on the teacher console immediately." },
              { n: "04", label: "Score Adjusted", desc: "Penalty multiplier applies to the candidate's final evaluation." },
            ].map((step, i, arr) => (
              <div key={step.n} className="flex flex-col md:flex-row items-center gap-0 flex-1 min-w-0">
                <div
                  className="rounded-[8.8px] border p-4 text-left flex-1 min-w-0"
                  style={{ background: "white", borderColor: C.ice }}
                >
                  <span className="font-mono text-2xl font-black block mb-1" style={{ color: `${C.cobalt}30` }}>{step.n}</span>
                  <h4 className="text-xs font-extrabold mb-0.5" style={{ color: C.ink }}>{step.label}</h4>
                  <p className="text-[10px] font-medium leading-relaxed" style={{ color: C.fog }}>{step.desc}</p>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="h-4 w-4 shrink-0 mx-2 hidden md:block" style={{ color: C.cobalt }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Capabilities Grid ───────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={staggerContainer(0.05)}
        className="py-24 px-6 border-t"
        style={{ background: C.paper, borderColor: C.ice }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
              Platform Capabilities
            </motion.span>
            <motion.h2 variants={childUp} className="text-3xl font-extrabold -tracking-wide" style={{ color: C.ink }}>
              Built for every assessment need.
            </motion.h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CAPABILITIES.map(({ icon: Icon, label, bg, accent, pill }) => (
              <motion.div
                key={label}
                variants={childUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-[8.8px] border p-4 flex flex-col gap-3 cursor-default"
                style={{ background: bg, borderColor: C.ice }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="h-8 w-8 rounded-[8.8px] flex items-center justify-center"
                    style={{ background: "white", border: `1px solid ${C.ice}` }}
                  >
                    <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[8px] font-bold border"
                    style={{ background: "white", borderColor: C.ice, color: accent }}
                  >
                    {pill}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold leading-snug" style={{ color: C.ink }}>{label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Live Telemetry ─────────────────────────────────────────────── */}
      <section
        id="telemetry"
        className="py-24 px-6 border-t"
        style={{ background: C.peach, borderColor: C.ice }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={staggerContainer(0.1)}
            className="flex flex-col lg:flex-row items-start gap-12"
          >
            <div className="flex-1 space-y-4">
              <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: C.cobalt }}>
                Live Monitoring
              </motion.span>
              <motion.h2 variants={childUp} className="text-3xl font-extrabold -tracking-wide leading-tight" style={{ color: C.ink }}>
                <WaveText text="Teachers see the exam happening." stagger={0.06} />
              </motion.h2>
              <motion.p variants={childUp} className="text-sm font-medium leading-relaxed" style={{ color: C.fog }}>
                The teacher console streams live progress, leaderboard reordering, and integrity warnings as they occur. No refresh required.
              </motion.p>
              <motion.ul variants={staggerContainer(0.07)} className="space-y-2 text-xs font-bold" style={{ color: C.ink }}>
                {[
                  "Layout-animated leaderboard re-sorting",
                  "Instant incident flag markers",
                  "Per-student progress bars",
                  "Connection health indicators",
                ].map((item) => (
                  <motion.li key={item} variants={childUp} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: C.cobalt }} />
                    {item}
                  </motion.li>
                ))}
              </motion.ul>
            </div>
            <motion.div variants={sectionVariants} className="flex-1 w-full max-w-lg">
              <LiveTelemetry />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ─── Offline Architecture ────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={sectionVariants}
        className="py-24 px-6 border-t"
        style={{ background: C.paper, borderColor: C.ice }}
      >
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-4 text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: C.cobalt }}>
              Connectivity Resilience
            </span>
            <h2 className="text-3xl font-extrabold -tracking-wide leading-tight" style={{ color: C.ink }}>
              Built for classrooms where the internet isn&apos;t perfect.
            </h2>
            <p className="text-sm font-medium leading-relaxed" style={{ color: C.fog }}>
              Losing internet mid-exam shouldn&apos;t invalidate submissions. DynoQuizz downloads the entire exam package locally, caches every response, and syncs automatically when connectivity returns.
            </p>
          </div>
          <div className="flex-1 w-full max-w-md">
            <div className="rounded-[8.8px] border p-6" style={{ background: "white", borderColor: C.ice }}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-center mb-6" style={{ color: C.fog }}>
                Offline Persistence Lifecycle
              </p>
              <div className="space-y-2.5">
                {[
                  { label: "Online — Package Downloaded", bg: C.blue, color: C.cobalt },
                  { label: "Offline — Assessment Continues Locally", bg: C.rose, color: "#9c3535" },
                  { label: "Reconnected — Responses Auto-Synced", bg: C.mint, color: "#1d6b42" },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="rounded-[8.8px] border px-4 py-3 text-xs font-bold"
                    style={{ background: step.bg, borderColor: C.ice, color: step.color }}
                  >
                    {step.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── Assessment Workflow Stage Slider ───────────────────────────── */}
      <section
        id="workflow"
        className="py-24 px-6 border-t"
        style={{ background: C.chalk, borderColor: C.ice }}
      >
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={vp}
            variants={staggerContainer(0.08)}
          >
            <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
              Platform Stages
            </motion.span>
            <motion.h2 variants={childUp} className="text-3xl font-extrabold -tracking-wide mb-10" style={{ color: C.ink }}>
              One platform. Every stage of assessment.
            </motion.h2>
          </motion.div>

          {/* Tab row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={vp}
            transition={{ duration: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-8 p-1.5 rounded-[8.8px] border max-w-xl mx-auto"
            style={{ background: "rgba(230,227,226,0.5)", borderColor: C.ice }}
          >
            {STAGES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { setActiveSlide(idx); setAutoplay(false); }}
                className="rounded-[8.8px] px-3.5 py-2 text-xs font-bold transition-all cursor-pointer border-0"
                style={{
                  background: activeSlide === idx ? "white" : "transparent",
                  color: activeSlide === idx ? C.ink : C.fog,
                  boxShadow: activeSlide === idx ? `0 0 0 1px ${C.ice}` : "none",
                }}
              >
                {s.label}
              </button>
            ))}
          </motion.div>

          {/* Slide viewer */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={vp}
            transition={{ duration: 0.5 }}
            className="relative max-w-2xl mx-auto overflow-hidden rounded-[8.8px] border text-left"
            style={{ background: "white", borderColor: C.ice }}
            onMouseEnter={() => setAutoplay(false)}
            onMouseLeave={() => setAutoplay(true)}
          >
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.cobalt }}>
                  STAGE 0{activeSlide + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setActiveSlide((p) => (p - 1 + STAGES.length) % STAGES.length); setAutoplay(false); }}
                    className="p-1 rounded-[8.8px] border cursor-pointer transition-colors hover:bg-[#f5f5f4]"
                    style={{ borderColor: C.ice }}
                  >
                    <ChevronLeft className="h-4 w-4" style={{ color: C.ink }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveSlide((p) => (p + 1) % STAGES.length); setAutoplay(false); }}
                    className="p-1 rounded-[8.8px] border cursor-pointer transition-colors hover:bg-[#f5f5f4]"
                    style={{ borderColor: C.ice }}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: C.ink }} />
                  </button>
                </div>
              </div>
              <div className="flex gap-5 items-start">
                <div
                  className="h-12 w-12 shrink-0 rounded-[8.8px] flex items-center justify-center border"
                  style={{ background: STAGES[activeSlide].bg, borderColor: C.ice }}
                >
                  <FileQuestion className="h-5 w-5" style={{ color: C.cobalt }} />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold -tracking-wide mb-1" style={{ color: C.ink }}>
                    {STAGES[activeSlide].title}
                  </h4>
                  <p className="text-xs font-medium leading-relaxed" style={{ color: C.fog }}>
                    {STAGES[activeSlide].desc}
                  </p>
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: C.ice }}>
              <motion.div
                key={activeSlide}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: autoplay ? 4.8 : 0, ease: "linear" }}
                className="h-full"
                style={{ background: C.cobalt }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Dynamic Scoring split ───────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={sectionVariants}
        className="py-24 px-6 border-t"
        style={{ background: C.paper, borderColor: C.ice }}
      >
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="flex-1 space-y-4 text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest block" style={{ color: C.cobalt }}>
              Scoring Intelligence
            </span>
            <h2 className="text-3xl font-extrabold -tracking-wide leading-tight" style={{ color: C.ink }}>
              Not every correct answer tells the whole story.
            </h2>
            <p className="text-sm font-medium leading-relaxed" style={{ color: C.fog }}>
              DynoQuizz maps response speed to score value. Fast, independent answers receive full marks. Slow submissions that correlate with peers trigger a decay factor — incentivizing genuine comprehension.
            </p>
          </div>
          <div className="flex-1 w-full max-w-sm space-y-4">
            {[
              { name: "Candidate A", time: "4.5s", correlation: "Isolated", score: "100%", fast: true },
              { name: "Candidate B", time: "28.8s", correlation: "High Risk", score: "82%", fast: false },
            ].map((c) => (
              <div
                key={c.name}
                className="rounded-[8.8px] border p-4"
                style={{ background: "white", borderColor: C.ice }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold" style={{ color: C.ink }}>{c.name}</span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[9px] font-bold border"
                    style={{
                      background: c.fast ? C.mint : C.peach,
                      borderColor: c.fast ? "#c0e8d0" : "#f0d5c0",
                      color: c.fast ? "#1d6b42" : "#b05430",
                    }}
                  >
                    {c.fast ? "Fast Response" : "Delayed Response"}
                  </span>
                </div>
                <div className="space-y-1 text-[10px]" style={{ color: C.fog }}>
                  <div className="flex justify-between">
                    <span>Response time</span>
                    <span className="font-bold" style={{ color: C.ink }}>{c.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Correlation</span>
                    <span className="font-bold" style={{ color: C.ink }}>{c.correlation}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between text-xs font-bold" style={{ borderColor: C.ice }}>
                  <span style={{ color: C.fog }}>Score</span>
                  <span style={{ color: c.fast ? "#1d6b42" : C.fog }}>{c.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Built For Modern Assessments — Marquee ─────────────────────── */}
      <section
        className="py-16 border-y overflow-hidden"
        style={{ background: C.chalk, borderColor: C.ice }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={vp}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.fog }}>
            Built for modern assessments
          </p>
        </motion.div>
        <div className="overflow-hidden">
          <div className="animate-marquee gap-12 flex">
            {/* Duplicate for seamless loop */}
            {[...CATEGORIES, ...CATEGORIES].map((cat, idx) => (
              <span
                key={`${cat}-${idx}`}
                className="text-sm font-extrabold -tracking-wide shrink-0 cursor-default transition-colors duration-200 hover:text-[#165dfb]"
                style={{ color: "#78716b" }}
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why DynoQuizz ──────────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={staggerContainer(0.1)}
        className="py-24 px-6 border-t"
        style={{ background: C.paper, borderColor: C.ice }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest block mb-2" style={{ color: C.cobalt }}>
              Why DynoQuizz
            </motion.span>
            <motion.h2 variants={childUp} className="text-3xl font-extrabold -tracking-wide" style={{ color: C.ink }}>
              Assessments you can trust.
            </motion.h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Zero-Shadow UI", desc: "Clean flat surfaces with Ice Line borders for maximum readability under exam conditions.", bg: C.blue },
              { icon: Wifi, title: "Offline-First", desc: "Full exam packages download locally. Connection drops don't mean lost progress.", bg: C.mint },
              { icon: Zap, title: "Edge Intelligence", desc: "Proctoring runs inside the browser — no server round-trips for detection events.", bg: C.lavender },
              { icon: BarChart3, title: "Real-Time Data", desc: "Live streaming to teacher consoles. Every event lands in milliseconds.", bg: C.peach },
              { icon: Timer, title: "Dynamic Scoring", desc: "Time-correlated grading rewards quick independent responses and penalizes suspicious delays.", bg: C.yellow },
              { icon: FileQuestion, title: "CSV Import", desc: "Upload entire assessment banks in seconds using standard CSV template format.", bg: C.rose },
            ].map(({ icon: Icon, title, desc, bg }) => (
              <motion.div
                key={title}
                variants={childUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-[8.8px] border p-5 flex flex-col gap-3"
                style={{ background: bg, borderColor: C.ice }}
              >
                <div
                  className="h-8 w-8 rounded-[8.8px] flex items-center justify-center border"
                  style={{ background: "white", borderColor: C.ice }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: C.cobalt }} />
                </div>
                <h3 className="text-xs font-extrabold" style={{ color: C.ink }}>{title}</h3>
                <p className="text-[11px] font-medium leading-relaxed" style={{ color: C.fog }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ─── Final CTA ──────────────────────────────────────────────────── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={vp}
        variants={staggerContainer(0.12)}
        className="py-28 px-6 border-t text-center"
        style={{ background: C.blue, borderColor: C.ice }}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <motion.span variants={childUp} className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.cobalt }}>
            Get Started
          </motion.span>
          <motion.h2 variants={childUp} className="text-3xl sm:text-4xl font-extrabold -tracking-wide" style={{ color: C.ink }}>
            <WaveText text="Build assessments you can trust." stagger={0.08} />
          </motion.h2>
          <motion.p variants={childUp} className="text-sm font-medium max-w-md mx-auto" style={{ color: C.fog }}>
            Create a secure assessment, invite your students, and monitor the entire session in real time.
          </motion.p>
          <motion.div variants={childUp} className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-[8.8px] px-6 py-3 text-xs font-bold text-white border-0 transition-colors hover:opacity-90"
              style={{ background: C.cobalt }}
            >
              Start Free Trial <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/join"
              className="flex items-center gap-2 rounded-[8.8px] border px-6 py-3 text-xs font-bold transition-all hover:bg-[#e6e3e2]/40"
              style={{ borderColor: C.ice, color: C.ink, background: "white" }}
            >
              Enter Session Code
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-6" style={{ background: C.paper, borderColor: C.ice }}>
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: C.ink }}>
            <ShieldCheck className="h-4 w-4" style={{ color: C.cobalt }} />
            DynoQuizz Assessment Platform
          </div>
          <p className="text-xs font-medium" style={{ color: C.fog }}>
            © {new Date().getFullYear()} DynoQuizz. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
