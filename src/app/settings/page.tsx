"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  User,
  Bell,
  Shield,
  Save,
  Trash2,
  LogOut,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Moon,
  Monitor,
} from "lucide-react";

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: "profile",     label: "Profile",      icon: User    },
  { id: "preferences", label: "Preferences",  icon: Bell    },
  { id: "security",    label: "Security",     icon: Lock    },
  { id: "danger",      label: "Danger Zone",  icon: Shield  },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Reusable field wrapper ────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function TextInput({
  type = "text",
  placeholder,
  defaultValue,
  icon,
  rightSlot,
}: {
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 ${icon ? "pl-10" : "pl-4"} ${rightSlot ? "pr-12" : "pr-4"}`}
      />
      {rightSlot && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {rightSlot}
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  description,
  defaultChecked = false,
}: {
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${on ? "bg-blue-600" : "bg-slate-200"}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${on ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function ProfilePanel({ onSave }: { onSave: () => void }) {
  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-2xl font-bold text-white shadow-lg">
            S
          </div>
          <button className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white shadow-md transition-transform hover:scale-110">
            <User className="h-3.5 w-3.5" />
          </button>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Profile Photo</p>
          <p className="mt-0.5 text-xs text-slate-400">
            JPG, PNG or GIF · Max 2 MB
          </p>
          <button className="mt-2 text-xs font-semibold text-blue-600 hover:underline">
            Upload new photo
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full Name">
          <TextInput
            placeholder="Jane Doe"
            defaultValue="Student User"
            icon={<User className="h-4 w-4" />}
          />
        </Field>
        <Field label="Email Address" hint="Used for exam notifications and results.">
          <TextInput
            type="email"
            placeholder="you@university.edu"
            defaultValue="student@dynoquizz.dev"
            icon={<Mail className="h-4 w-4" />}
          />
        </Field>
        <Field label="Institution / University">
          <TextInput placeholder="e.g. IIT Delhi" defaultValue="IIT Delhi" />
        </Field>
        <Field label="Student Roll Number">
          <TextInput placeholder="e.g. 2021CS1001" defaultValue="2021CS1001" />
        </Field>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-2 rounded-full bg-black px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function PreferencesPanel({ onSave }: { onSave: () => void }) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");

  return (
    <div className="space-y-8">
      {/* Notification toggles */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Notifications
        </h3>
        <div className="space-y-3">
          <Toggle
            label="Email: Assessment Results"
            description="Get notified when a teacher publishes your graded results."
            defaultChecked={true}
          />
          <Toggle
            label="Email: Upcoming Assessments"
            description="Reminder 24 hours before a scheduled exam."
            defaultChecked={true}
          />
          <Toggle
            label="Email: Proctoring Reports"
            description="Receive a copy of the AI proctoring flag summary after each exam."
            defaultChecked={false}
          />
          <Toggle
            label="Browser Push Notifications"
            description="Real-time browser alerts for exam start and result publication."
            defaultChecked={false}
          />
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Theme */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { id: "system", label: "System",    icon: <Monitor className="h-5 w-5" /> },
              { id: "light",  label: "Light",     icon: <Eye className="h-5 w-5" /> },
              { id: "dark",   label: "Dark",      icon: <Moon className="h-5 w-5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 py-5 text-xs font-semibold transition-all ${
                theme === t.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-2 rounded-full bg-black px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
          Save Preferences
        </button>
      </div>
    </div>
  );
}

function SecurityPanel({ onSave }: { onSave: () => void }) {
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="space-y-8">
      {/* Change password */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Change Password
        </h3>
        <div className="space-y-4">
          <Field label="Current Password">
            <TextInput
              type={showCurrent ? "text" : "password"}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </Field>
          <Field label="New Password" hint="Minimum 8 characters with at least one number.">
            <TextInput
              type={showNew ? "text" : "password"}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </Field>
          <Field label="Confirm New Password">
            <TextInput
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </Field>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* 2FA */}
      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">
          Two-Factor Authentication
        </h3>
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-800">Authenticator App</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Use Google Authenticator or Authy to generate one-time codes.
            </p>
          </div>
          <button className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100">
            Set up <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          className="flex items-center gap-2 rounded-full bg-black px-7 py-3 text-sm font-bold text-white shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Save className="h-4 w-4" />
          Update Password
        </button>
      </div>
    </div>
  );
}

function DangerPanel() {
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_PHRASE = "delete my account";
  const ready = confirmText === CONFIRM_PHRASE;

  return (
    <div className="space-y-6">
      {/* Sign out all devices */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-amber-900">Sign out of all devices</p>
            <p className="mt-1 text-sm text-amber-700">
              This will immediately invalidate all active sessions across every
              browser and device.
            </p>
          </div>
        </div>
        <button className="shrink-0 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-700 transition-all hover:bg-amber-100">
          Sign out all
        </button>
      </div>

      {/* Delete account */}
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6">
        <div className="mb-5 flex gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-red-900">Delete Account</p>
            <p className="mt-1 text-sm text-red-700">
              Permanently remove your account, all assessments, results, and
              proctoring data. <strong>This action cannot be undone.</strong>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold text-red-700">
            Type{" "}
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono">
              {CONFIRM_PHRASE}
            </span>{" "}
            to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-red-200 focus:border-red-500 focus:ring-1 focus:ring-red-400"
          />
          <button
            disabled={!ready}
            className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all ${
              ready
                ? "bg-red-600 text-white shadow-lg shadow-red-200 hover:scale-[1.01] hover:bg-red-700 active:scale-[0.98]"
                : "cursor-not-allowed bg-red-100 text-red-300"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Permanently Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  // TODO: BACKEND INTEGRATION - On mount: GET /api/users/me with Authorization: Bearer {token}
  // Load profile data (name, email, institution, rollNumber, preferences).
  // On save profile/preferences/security: PUT /api/users/me with updated fields.
  // On account deletion (Danger Zone): DELETE /api/users/me -> clear token & redirect to /login.
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // TODO: BACKEND INTEGRATION - Dispatch PUT /api/users/me update call
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-[#f3eefc] font-sans">
      {/* ── Sticky nav ── */}
      <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-purple-100/60 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              DynoQuizz
            </span>
          </div>
        </div>

        {/* Save toast */}
        {saved && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
          </span>
        )}
      </nav>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
        {/* Page title */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
            Account
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your profile, preferences, and account security.
          </p>
        </div>

        {/* ── Tab layout ── */}
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* Sidebar tabs */}
          <nav className="flex shrink-0 gap-2 overflow-x-auto rounded-[2rem] bg-white p-2 shadow-2xl border border-white/50 lg:w-52 lg:flex-col lg:overflow-x-visible">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex min-w-max items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all lg:w-full ${
                  activeTab === id
                    ? id === "danger"
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-black text-white shadow-md"
                    : id === "danger"
                    ? "text-red-500 hover:bg-red-50"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="flex-1 rounded-[2.5rem] bg-white p-8 shadow-2xl border border-white/50">
            {activeTab === "profile"     && <ProfilePanel     onSave={handleSave} />}
            {activeTab === "preferences" && <PreferencesPanel onSave={handleSave} />}
            {activeTab === "security"    && <SecurityPanel    onSave={handleSave} />}
            {activeTab === "danger"      && <DangerPanel />}
          </div>
        </div>
      </main>
    </div>
  );
}
