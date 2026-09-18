"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
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
  LayoutDashboard,
  Settings as SettingsIcon,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { Logo } from "@/components/Logo";

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
    <div className="space-y-1 text-left">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-[#78716b]/80 font-medium">{hint}</p>}
    </div>
  );
}

function TextInput({
  type = "text",
  placeholder,
  value,
  onChange,
  icon,
  rightSlot,
}: {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#78716b]">
          {icon}
        </div>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`w-full rounded-[8.8px] border border-[#d1dee8] bg-[#e6e3e2]/40 py-2.5 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:bg-white font-medium ${icon ? "pl-9" : "pl-3"} ${rightSlot ? "pr-9" : "pr-3"}`}
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
    <div className="flex items-start justify-between gap-4 rounded-[8.8px] border border-[#d1dee8] bg-[#e6e3e2]/40 px-4 py-3.5 transition-colors">
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-bold text-[#111111]">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${on ? "bg-[#165dfb]" : "bg-[#d1dee8]"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${on ? "translate-x-4" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

function ProfilePanel({ onSave, user }: { onSave: () => void; user: any }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("VIT AP");
  const [program, setProgram] = useState("B.Tech Computer Science");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.name || user.fullName || "");
      setEmail(user.email || "");
      if (user.institution) setInstitution(user.institution);
      if (user.program) setProgram(user.program);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    const updatedUser = {
      ...(user || {}),
      name: fullName.trim() || user?.name || "User",
      email: email.trim() || user?.email || "",
      institution: institution.trim(),
      program: program.trim(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("dynoquizz_user", JSON.stringify(updatedUser));
    }

    try {
      const token = localStorage.getItem("dynoquizz_token");
      await fetch(`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080").replace(/\/+$/, "")}/api/v1/user/profile`, {
        method: "PUT",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedUser),
      });
    } catch {
      // Offline fallback saved in localStorage
    } finally {
      setSaving(false);
      onSave();
    }
  };

  const initial = fullName ? fullName.charAt(0).toUpperCase() : "U";

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex items-center gap-3.5 text-left">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#165dfb] text-lg font-bold text-white shadow-none">
            {initial}
          </div>
          <button className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f5f4] border border-[#d1dee8] text-[#78716b] shadow-none cursor-pointer">
            <User className="h-3 w-3 text-[#78716b]" />
          </button>
        </div>
        <div>
          <p className="text-xs font-bold text-[#111111]">Profile Photo</p>
          <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
            JPG, PNG or GIF · Max 2 MB
          </p>
          <button className="mt-0.5 text-[10px] font-bold text-[#165dfb] hover:underline cursor-pointer bg-transparent border-0">
            Upload new photo
          </button>
        </div>
      </div>

      <div className="h-px bg-[#d1dee8]/30" />

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
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all cursor-pointer border-0 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function PreferencesPanel({ onSave }: { onSave: () => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
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

      <div className="h-px bg-[#d1dee8]/30" />

      {/* Theme */}
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
          Appearance
        </h3>
        <div className="grid grid-cols-3 gap-3">
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
                className={`flex flex-col items-center gap-1.5 rounded-[8.8px] border py-3 text-xs font-bold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "border-[#165dfb] bg-[#e6e3e2]/40 text-[#165dfb]"
                    : "border-[#d1dee8] bg-white text-[#78716b] hover:border-[#d1dee8]/70 hover:text-[#111111]"
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
          className="flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all cursor-pointer border-0"
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
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
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
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
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
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
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
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
          </Field>
        </div>
      </div>

      <div className="h-px bg-[#d1dee8]/30" />

      {/* 2FA */}
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
          Two-Factor Authentication
        </h3>
        <div className="flex items-center justify-between rounded-[8.8px] border border-[#d1dee8] bg-[#e6e3e2]/40 p-3.5 text-left">
          <div>
            <p className="text-xs font-bold text-[#111111]">Authenticator App</p>
            <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
              Use Google Authenticator or Authy to generate one-time codes.
            </p>
          </div>
          <button className="flex items-center gap-1.5 rounded-[8.8px] border border-[#d1dee8] bg-white px-3.5 py-1.5 text-xs font-bold text-[#111111] hover:bg-[#e6e3e2] active:scale-[0.98] transition-all cursor-pointer">
            Set up <ChevronRight className="h-3 w-3 text-[#78716b]" />
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-[8.8px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 transition-all cursor-pointer border-0"
        >
          <Save className="h-3.5 w-3.5" />
          Update Password
        </button>
      </div>
    </div>
  );
}

function DangerPanel() {
  const { logout } = useSession();
  const [confirmText, setConfirmText] = useState("");
  const CONFIRM_PHRASE = "delete my account";
  const ready = confirmText === CONFIRM_PHRASE;

  return (
    <div className="space-y-4">
      {/* Sign out all devices */}
      <div className="flex items-start justify-between gap-4 rounded-[8.8px] border border-[#73561a]/20 bg-[#f6efe1] p-4 text-left">
        <div className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8.8px] bg-white text-[#73561a] border border-[#d1dee8]/30">
            <LogOut className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-[#73561a] text-xs">Sign out of all devices</p>
            <p className="mt-0.5 text-[10px] text-[#73561a]/90 font-medium leading-normal">
              This will immediately invalidate all active sessions across every browser and device.
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="shrink-0 rounded-[8.8px] border border-[#73561a]/30 bg-white px-3 py-1 text-[10px] font-bold text-[#73561a] hover:bg-[#f6efe1]/30 transition-colors cursor-pointer"
        >
          Sign out all
        </button>
      </div>

      {/* Delete account */}
      <div className="rounded-[8.8px] border border-[#8c381c]/20 bg-[#fbeee8] p-4 text-left">
        <div className="mb-3 flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8.8px] bg-white text-[#8c381c] border border-[#d1dee8]/30">
            <Trash2 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-[#8c381c] text-xs">Delete Account</p>
            <p className="mt-0.5 text-[10px] text-[#8c381c]/90 font-medium leading-normal">
              Permanently remove your account, all assessments, results, and proctoring data. <strong>This action cannot be undone.</strong>
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[#8c381c]">
            Type{" "}
            <span className="rounded bg-white px-1 py-0.5 font-mono text-[#8c381c]">
              {CONFIRM_PHRASE}
            </span>{" "}
            to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-[8.8px] border border-[#8c381c]/30 bg-white px-3 py-2 text-xs text-[#8c381c] outline-none transition-colors placeholder:text-[#8c381c]/40 focus:border-[#8c381c]/75 font-medium"
          />
          <button
            disabled={!ready}
            className={`flex w-full items-center justify-center gap-1.5 rounded-[8.8px] px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer border-0 ${
              ready
                ? "bg-[#fbeee8] text-[#8c381c] hover:bg-[#fbeee8]/90 hover:text-white"
                : "cursor-not-allowed bg-[#fbeee8]/50 text-[#8c381c]/50"
            }`}
          >
            <AlertTriangle className="h-4 w-4 animate-pulse" />
            Permanently Delete My Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, logout } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const dashboardHref = user
    ? user.role === "teacher"
      ? "/dashboard/teacher"
      : "/dashboard/student"
    : "/";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex overflow-hidden">
      {/* Left Sidebar Navigation */}
      <aside className="w-64 bg-[#f5f5f4] border-r border-[#d1dee8] flex flex-col shrink-0">
        {/* Header Logo */}
        <div className="p-6 border-b border-[#d1dee8]/50">
          <Logo />
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 text-left">
          <Link
            href={dashboardHref}
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] transition-all"
          >
            <LayoutDashboard className="h-4 w-4 text-[#78716b]" />
            Dashboard
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-[8.8px] px-3.5 py-2.5 text-xs font-bold bg-[#165dfb] text-white transition-all border-0"
          >
            <SettingsIcon className="h-4 w-4 text-white" />
            Settings
          </Link>
        </nav>

        {/* User Card & Sign Out bottom */}
        <div className="p-4 border-t border-[#d1dee8]/50 text-left space-y-3">
          <div className="flex items-center gap-2.5 px-2.5 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6e3e2] border border-[#d1dee8] text-xs font-bold text-[#111111]">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#111111] truncate">{user?.name || "User"}</p>
              <p className="text-[9px] text-[#78716b] font-medium uppercase">{user?.role || "Account"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-[8.8px] border border-[#d1dee8] bg-white py-2 text-xs font-bold text-[#8c381c] hover:bg-[#fbeee8] transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5 text-[#8c381c]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-left">
        {/* Page title */}
        <section className="border-b border-[#d1dee8]/50 pb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Account Center
            </span>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111] -tracking-wide">
              Settings
            </h1>
            <p className="mt-0.5 text-xs text-[#78716b] font-medium">
              Manage your profile, preferences, and account security.
            </p>
          </div>

          {/* Save toast */}
          {saved && (
            <span className="flex items-center gap-1 rounded-[8.8px] bg-[#e2ede8] px-2.5 py-1 text-xs font-bold text-[#1d5237] border border-[#d1dee8] shadow-none animate-bounce">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" /> Saved!
            </span>
          )}
        </section>

        {/* Tab layout */}
        <div className="flex flex-col gap-5 lg:flex-row items-start">
          {/* Sidebar tabs */}
          <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-[8.8px] bg-[#e6e3e2]/40 p-1.5 border border-[#d1dee8] lg:w-44 lg:flex-col lg:overflow-x-visible">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex min-w-max items-center gap-2 rounded-[8.8px] px-3 py-2 text-xs font-bold transition-all duration-150 lg:w-full cursor-pointer border-0 ${
                  activeTab === id
                    ? id === "danger"
                      ? "bg-[#fbeee8] text-[#8c381c]"
                      : "bg-[#165dfb] text-white"
                    : id === "danger"
                    ? "text-[#8c381c] hover:bg-[#fbeee8]/40 bg-transparent"
                    : "text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] bg-transparent"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Panel */}
          <div className="flex-1 w-full rounded-[8.8px] bg-white p-5 border border-[#d1dee8]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "profile"     && <ProfilePanel     onSave={handleSave} user={user} />}
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
