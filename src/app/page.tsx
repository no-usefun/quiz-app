import Link from "next/link";
import {
  ShieldCheck,
  Wand2,
  ArrowRight,
  MonitorSmartphone,
  Eye,
  Timer,
  Trophy,
  Zap,
  CheckCircle2,
  BarChart3,
  Mail,
  Globe,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f3eefc] p-4 md:p-6 lg:p-8 font-sans">
      <div className="mx-auto flex min-h-[90vh] max-w-[1400px] flex-col rounded-[2.5rem] bg-white shadow-2xl relative overflow-hidden border border-white/50">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <header className="relative z-10 w-full px-8 py-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                DynoQuizz
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <Link
                href="#product"
                className="hover:text-black transition-colors"
              >
                Product
              </Link>
              <Link
                href="#scoring"
                className="hover:text-black transition-colors"
              >
                Dynamic Scoring
              </Link>
              <Link href="#faq" className="hover:text-black transition-colors">
                FAQ
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden md:block text-sm font-semibold text-slate-600 hover:text-black transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95"
              >
                Try DynoQuizz <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="relative z-10 flex flex-col items-center justify-center px-6 pt-16 pb-20 text-center md:pt-24 md:pb-32">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 shadow-sm">
            Fair, secure, scalable <Wand2 className="h-4 w-4 text-blue-600" />
          </div>

          <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl md:leading-[1.1]">
            Test fairer with AI and <br className="hidden md:block" />{" "}
            collaborate seamlessly
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500">
            Say goodbye to browser switching and second-guessing academic
            integrity. DynoQuizz helps you proctor any exam in just a few
            clicks.
          </p>

          <Link
            href="/signup"
            className="mt-10 flex items-center gap-2 rounded-full bg-black px-6 py-3.5 text-base font-medium text-white transition-transform hover:scale-105 active:scale-95 shadow-xl shadow-black/10"
          >
            Start testing smarter <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section
          id="product"
          className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div className="group rounded-[2rem] bg-gradient-to-br from-pink-300 via-white to-blue-300 p-[2px] shadow-lg transition-all hover:shadow-xl">
              <div className="flex h-full flex-col rounded-[calc(2rem-2px)] bg-white p-8">
                <div className="mb-auto flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                    <MonitorSmartphone className="h-6 w-6 text-slate-700" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">
                    Step 1
                  </span>
                </div>
                <div className="mt-12">
                  <h3 className="mb-2 text-xl font-bold text-slate-900">
                    Instant Access
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    Drop in your test code — anything from a mid-term to a
                    practice PYQ. Accessible instantly via secure links or QR
                    scans.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] bg-gradient-to-br from-blue-600 via-purple-500 to-orange-400 p-8 text-white shadow-xl">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-white/80">
                  Step 2
                </span>
              </div>
              <h3 className="mb-4 text-3xl font-bold tracking-tight">
                Edge-AI Proctoring
              </h3>
              <p className="text-sm leading-relaxed text-white/90">
                Detect faces, track eyes, and monitor browser activity entirely
                on the student's device. Zero server lag, total privacy.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
                  Face Detection ✓
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
                  Tab Tracking ✓
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-md">
                  Object AI ✦
                </span>
              </div>
            </div>

            <div className="group rounded-[2rem] bg-gradient-to-br from-purple-300 via-white to-orange-200 p-[2px] shadow-lg transition-all hover:shadow-xl">
              <div className="flex h-full flex-col rounded-[calc(2rem-2px)] bg-white p-8">
                <div className="mb-auto flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                    <Timer className="h-6 w-6 text-slate-700" />
                  </div>
                  <span className="text-sm font-medium text-slate-400">
                    Step 3
                  </span>
                </div>
                <div className="mt-12">
                  <h3 className="mb-2 text-xl font-bold text-slate-900">
                    Dynamic Scoring
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-500">
                    AI calculates marks instantly based on time and accuracy.
                    Answering faster yields a higher score, stopping answer
                    sharing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="scoring"
          className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24"
        >
          <div className="rounded-[2.5rem] bg-slate-50 border border-slate-200 p-8 md:p-16 flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-700 mb-6">
                <BarChart3 className="h-4 w-4" /> Live Telemetry
              </div>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-6">
                Scores that reflect <br /> true knowledge.
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                If someone answers a complex question in 5 seconds and another
                in 29 seconds, should they get the same mark? Our algorithm
                adjusts marks based on teacher-configured time constraints to
                eliminate cheating loops.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-slate-700 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />{" "}
                  Auto-updates live in the Teacher Dashboard
                </li>
                <li className="flex items-center gap-3 text-slate-700 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Flags
                  suspicious behavior instantly
                </li>
                <li className="flex items-center gap-3 text-slate-700 font-medium">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" /> 1-Click
                  Export to Excel / CSV
                </li>
              </ul>
            </div>

            <div className="flex-1 w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl shadow-blue-900/5">
              <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="flex items-center font-bold text-lg">
                  <Trophy className="w-5 h-5 text-amber-500 mr-2" /> Class
                  Leaderboard
                </h3>
                <span className="flex items-center text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                  <Zap className="w-3 h-3 mr-1" /> Live
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 text-sm">
                      1
                    </span>
                    <div className="font-semibold text-slate-900 text-sm">
                      Suryanshu S.
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">98.5 pts</div>
                    <div className="text-xs text-slate-400 font-medium">
                      Avg: 4.2s
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-red-50 p-4 border border-red-100">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-200 font-bold text-red-700 text-sm">
                      2
                    </span>
                    <div className="font-semibold text-red-900 text-sm">
                      Student B
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">82.1 pts</div>
                    <div className="text-xs text-red-500 font-medium flex items-center gap-1">
                      Avg: 24s <Eye className="w-3 h-3" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 text-sm">
                      3
                    </span>
                    <div className="font-semibold text-slate-900 text-sm">
                      Student C
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-slate-600">79.0 pts</div>
                    <div className="text-xs text-slate-400 font-medium">
                      Avg: 18.5s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-24"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-slate-900">
              Questions Meet Answers
            </h2>
            <p className="mt-4 text-slate-500">
              Everything you need to know about the platform.
            </p>
          </div>

          <div className="space-y-4">
            <details className="group rounded-2xl border border-slate-200 bg-white p-6 [&_summary::-webkit-details-marker]:hidden cursor-pointer shadow-sm">
              <summary className="flex items-center justify-between font-semibold text-slate-900">
                Do students need an account to take a test?
                <span className="transition group-open:rotate-180">
                  <svg
                    fill="none"
                    height="24"
                    shapeRendering="geometricPrecision"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path d="M6 9l6 6 6-6"></path>
                  </svg>
                </span>
              </summary>
              <p className="mt-4 text-slate-500 text-sm leading-relaxed">
                Yes. To ensure the integrity of the data, Suspicion Scores, and
                the Leaderboard, all users must log in before joining an
                official assessment.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-white p-6 [&_summary::-webkit-details-marker]:hidden cursor-pointer shadow-sm">
              <summary className="flex items-center justify-between font-semibold text-slate-900">
                Will the AI proctoring lag my computer?
                <span className="transition group-open:rotate-180">
                  <svg
                    fill="none"
                    height="24"
                    shapeRendering="geometricPrecision"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path d="M6 9l6 6 6-6"></path>
                  </svg>
                </span>
              </summary>
              <p className="mt-4 text-slate-500 text-sm leading-relaxed">
                Not at all. Unlike platforms that stream 30 FPS video to a
                server, our AI runs entirely on your local browser edge at a
                throttled 2-3 frames per second, requiring almost zero
                bandwidth.
              </p>
            </details>

            <details className="group rounded-2xl border border-slate-200 bg-white p-6 [&_summary::-webkit-details-marker]:hidden cursor-pointer shadow-sm">
              <summary className="flex items-center justify-between font-semibold text-slate-900">
                What browser events are tracked?
                <span className="transition group-open:rotate-180">
                  <svg
                    fill="none"
                    height="24"
                    shapeRendering="geometricPrecision"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                    width="24"
                  >
                    <path d="M6 9l6 6 6-6"></path>
                  </svg>
                </span>
              </summary>
              <p className="mt-4 text-slate-500 text-sm leading-relaxed">
                We track tab switching, exiting fullscreen mode, copying,
                pasting, right-clicking, and window minimization. All events are
                batched and securely sent to the teacher's dashboard.
              </p>
            </details>
          </div>
        </section>

        <footer className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-8">
          <div className="rounded-[2.5rem] bg-slate-900 px-8 py-12 md:px-16 md:py-16 text-white flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-3xl font-bold mb-4">
                Ready to upgrade your assessments?
              </h3>
              <p className="text-slate-400 max-w-md text-sm leading-relaxed">
                Join our platform for free and start hosting completely secure,
                AI-proctored tests without concurrent user limits.
              </p>
            </div>
            <div className="flex flex-col gap-4 min-w-[200px]">
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 rounded-full bg-white text-black px-6 py-3.5 text-sm font-bold transition-transform hover:scale-105"
              >
                Create Free Account
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 rounded-full border border-slate-700 bg-transparent px-6 py-3.5 text-sm font-bold transition-colors hover:bg-slate-800"
              >
                Teacher Login
              </Link>
            </div>
          </div>

          <div className="mt-12 flex flex-col md:flex-row items-center justify-between border-t border-slate-100 pt-8 text-sm text-slate-400">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              <span className="font-bold text-slate-900">DynoQuizz</span>
              <span className="ml-2">
                © {new Date().getFullYear()} DynoQuizz. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <Link
                href="https://github.com/suryanshusaini"
                target="_blank"
                rel="noreferrer"
                className="hover:text-slate-900 transition-colors"
              >
                <Globe className="w-5 h-5" />
              </Link>
              <Link
                href="mailto:suryanshusaini2009@gmail.com"
                className="hover:text-slate-900 transition-colors"
              >
                <Mail className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
