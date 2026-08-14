"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
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
    <div className="space-y-1">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

function TextInput({
  type = "text",
  placeholder,
  value,
  defaultValue,
  onChange,
  icon,
  rightSlot,
}: {
  type?: string;
  placeholder?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        className={`w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white font-medium ${icon ? "pl-9" : "pl-3"} ${rightSlot ? "pr-9" : "pr-3"}`}
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
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-slate-550 font-medium">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${on ? "bg-blue-600" : "bg-slate-200"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform duration-150 ${on ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function ProfilePanel({ onSave }: { onSave: () => void }) {
  const [fullName, setFullName] = useState("Suryanshu Saini");
  const [email, setEmail] = useState("suryanshu.saini@university.edu");
  const [institution, setInstitution] = useState("VIT AP");
  const [program, setProgram] = useState("B.Tech Computer Science");

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-3.5">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-xs">
            S
          </div>
          <button className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-600 shadow-xs">
            <User className="h-3 w-3" />
          </button>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-805">Profile Photo</p>
          <p className="mt-0.5 text-[10px] text-slate-400 font-medium">
            JPG, PNG or GIF · Max 2 MB
          </p>
          <button className="mt-0.5 text-[10px] font-bold text-blue-600 hover:underline">
            Upload new photo
          </button>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name">
          <TextInput
            placeholder="Suryanshu Saini"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User className="h-4 w-4" />}
          />
        </Field>
        <Field label="Email Address" hint="Used for exam notifications and results.">
          <TextInput
            type="email"
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="h-4 w-4" />}
          />
        </Field>
        <Field label="Institution / University">
          <TextInput
            placeholder="VIT AP"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </Field>
        <Field label="Course / Program">
          <TextInput
            placeholder="B.Tech Computer Science"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
        >
          <Save className="h-3.5 w-3.5" />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function PreferencesPanel({ onSave }: { onSave: () => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5">
      {/* Notification toggles */}
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Notifications
        </h3>
        <div className="space-y-2">
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
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3.5">
          {(
            [
              { id: "system", label: "System",    icon: <Monitor className="h-4 w-4" /> },
              { id: "light",  label: "Light",     icon: <Eye className="h-4 w-4" /> },
              { id: "dark",   label: "Dark",      icon: <Moon className="h-4 w-4" /> },
            ] as const
          ).map((t) => {
            const isActive = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-bold transition-all ${
                  isActive
                    ? "border-blue-600 bg-blue-50/50 text-blue-700"
                    : "border-slate-205 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
        >
          <Save className="h-3.5 w-3.5" />
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
    <div className="space-y-5">
      {/* Change password */}
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Change Password
        </h3>
        <div className="space-y-3">
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
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Two-Factor Authentication
        </h3>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
          <div>
            <p className="text-xs font-bold text-slate-800">Authenticator App</p>
            <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
              Use Google Authenticator or Authy to generate one-time codes.
            </p>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs">
            Set up <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 active:scale-95 transition-all shadow-xs"
        >
          <Save className="h-3.5 w-3.5" />
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
    <div className="space-y-4">
      {/* Sign out all devices */}
      <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <LogOut className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-amber-900 text-xs">Sign out of all devices</p>
            <p className="mt-0.5 text-[10px] text-amber-700 font-medium">
              This will immediately invalidate all active sessions across every browser and device.
            </p>
          </div>
        </div>
        <button className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 text-[10px] font-bold text-amber-700 hover:bg-amber-50 transition-colors">
          Sign out all
        </button>
      </div>

      {/* Delete account */}
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="mb-3 flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
            <Trash2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-rose-900 text-xs">Delete Account</p>
            <p className="mt-0.5 text-[10px] text-rose-700 font-medium">
              Permanently remove your account, all assessments, results, and proctoring data. <strong>This action cannot be undone.</strong>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-rose-800">
            Type{" "}
            <span className="rounded bg-rose-105 px-1 py-0.5 font-mono text-rose-900">
              {CONFIRM_PHRASE}
            </span>{" "}
            to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors placeholder:text-rose-300 focus:border-rose-500 font-medium"
          />
          <button
            disabled={!ready}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              ready
                ? "bg-rose-600 text-white hover:bg-rose-700 active:scale-95"
                : "cursor-not-allowed bg-rose-100 text-rose-300"
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
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-850 selection:bg-blue-105 selection:text-blue-900">
      {/* Top Nav */}
      <nav className="sticky top-0 z-20 flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <span className="text-slate-200">|</span>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold tracking-tight text-slate-900">
              DynoQuizz
            </span>
          </div>
        </div>

        {/* Save toast */}
        {saved && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved!
          </span>
        )}
      </nav>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {/* Page title */}
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Account Center
          </span>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 font-medium">
            Manage your profile, preferences, and account security.
          </p>
        </div>

        {/* ── Tab layout ── */}
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* Sidebar tabs */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-xl bg-white p-1.5 border border-slate-200 lg:w-44 lg:flex-col lg:overflow-x-visible">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-all lg:w-full ${
                  activeTab === id
                    ? id === "danger"
                      ? "bg-rose-600 text-white shadow-xs"
                      : "bg-blue-600 text-white shadow-xs"
                    : id === "danger"
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-slate-505 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="flex-1 rounded-2xl bg-white p-5 border border-slate-200 shadow-xs">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "profile"     && <ProfilePanel     onSave={handleSave} />}
                {activeTab === "preferences" && <PreferencesPanel onSave={handleSave} />}
                {activeTab === "security"    && <SecurityPanel    onSave={handleSave} />}
                {activeTab === "danger"      && <DangerPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
