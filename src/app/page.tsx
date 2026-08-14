"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  MonitorSmartphone,
  Eye,
  Timer,
  Trophy,
  Zap,
  CheckCircle2,
  BarChart3,
  Sparkles,
} from "lucide-react";

const FEATURES = [
  {
    icon: <MonitorSmartphone className="h-5 w-5" />,
    title: "Instant Code Join",
    desc: "Students enter a simple 6-character code or scan a QR code to download their encrypted exam package offline.",
  },
  {
    icon: <Eye className="h-5 w-5" />,
    title: "Edge-AI Proctoring",
    desc: "Detect face presence, eye movement, tab switching, right-clicking, and copy attempts directly inside the browser.",
  },
  {
    icon: <Timer className="h-5 w-5" />,
    title: "Dynamic Time Scoring",
    desc: "Scores adapt dynamically to response time, discouraging answer sharing while rewarding swift comprehension.",
  },
];

const FAQS = [
  {
    q: "Do students require an account to take a test?",
    a: "Yes. Student login ensures accurate scorecard tracking, student ID verification, and integrity records across tests.",
  },
  {
    q: "How does offline assessment work?",
    a: "The student downloads the encrypted assessment bundle during verification. Once cached, the test runs smoothly even if internet connectivity drops temporarily.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="sticky top-0 z-20 w-full bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-905">
              DynoQuizz
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-500">
            <Link href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </Link>
            <Link href="#scoring" className="hover:text-slate-900 transition-colors">
              Dynamic Scoring
            </Link>
            <Link href="#faq" className="hover:text-slate-900 transition-colors">
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
            >
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center"
      >
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" /> Offline-First Assessment Platform
        </div>

        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl md:leading-tight">
          Secure, Fair &amp; AI-Proctored Assessments for Education
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm text-slate-550 leading-relaxed font-medium">
          Host offline-ready quizzes with local Edge-AI proctoring, face verification, and dynamic time-decay scoring. Zero lag, full academic integrity.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center gap-2.5">
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-xs"
          >
            Start Free Trial <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-55 transition-colors shadow-xs"
          >
            Enter Session Code
          </Link>
        </div>
      </motion.section>

      {/* Feature Cards */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
        id="features"
        className="mx-auto w-full max-w-5xl px-6 pb-12"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Built for Modern Classrooms
          </h2>
          <p className="mt-1 text-slate-550 text-xs font-medium">
            Everything you need to deliver cheating-resistant online exams.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut", delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -2 }}
              className="rounded-xl bg-white p-5 border border-slate-200 shadow-xs hover:shadow-sm transition-all"
            >
              <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                {card.icon}
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-slate-900">{card.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">{card.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Live Leaderboard / Scoring Preview */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        id="scoring"
        className="mx-auto w-full max-w-5xl px-6 pb-12"
      >
        <div className="rounded-xl bg-white p-6 md:p-8 flex flex-col lg:flex-row items-center gap-8 border border-slate-200 shadow-xs">
          <div className="flex-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 mb-3 border border-blue-100">
              <BarChart3 className="h-3.5 w-3.5" /> Live Telemetry
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-2">
              Real-Time Proctoring &amp; Analytics
            </h2>
            <p className="text-slate-555 mb-4 leading-relaxed text-xs font-medium">
              Teachers receive live telemetry updates during active assessments. Suspicion flags and score adjustments are logged transparently.
            </p>
            <ul className="space-y-2 text-xs font-semibold text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Auto-syncing live teacher leaderboard
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Suspicion badge warnings (Tab switch, Fullscreen exit, Copy)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> 1-Click CSV scorecard export
              </li>
            </ul>
          </div>

          <div className="flex-1 w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="flex items-center font-bold text-slate-900 text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-500 mr-1.5" /> Live Leaderboard Preview
              </h3>
              <span className="flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Zap className="w-3.5 h-3.5 mr-0.5 text-emerald-650" /> Active
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-200 shadow-xs text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600 text-[10px]">
                    1
                  </span>
                  <span className="font-bold text-slate-900">Aarav Sharma</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">95.0%</span>
                  <span className="text-[9px] text-slate-400 block font-medium">Avg 4.2s</span>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50/50 p-3 border border-blue-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-[10px]">
                    2
                  </span>
                  <span className="font-bold text-slate-900">Rohit Verma</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-blue-700">78.0%</span>
                  <span className="text-[9px] text-blue-500 block font-medium">Flagged (Tab switch)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* FAQ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.15 }}
        id="faq"
        className="mx-auto w-full max-w-2xl px-6 pb-12"
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            Frequently Asked Questions
          </h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-lg bg-white p-4 cursor-pointer border border-slate-200 shadow-xs"
            >
              <summary className="flex items-center justify-between font-bold text-slate-800 text-xs list-none">
                {faq.q}
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-open:rotate-90 transition-transform shrink-0 ml-2" />
              </summary>
              <p className="mt-2 text-slate-500 text-xs leading-relaxed font-medium">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-between max-w-5xl mx-auto gap-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            DynoQuizz Assessment Platform
          </div>
          <div className="font-medium">
            © {new Date().getFullYear()} DynoQuizz. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
