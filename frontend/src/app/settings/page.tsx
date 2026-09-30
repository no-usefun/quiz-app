"use client";

import { useEffect, useState } from "react";
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
import { ENDPOINTS } from "@/lib/api/endpoints";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Preferences", icon: Bell },
  { id: "security", label: "Security", icon: Lock },
  { id: "danger", label: "Danger Zone", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#78716b]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-[#78716b]/80 font-medium">{hint}</p>
      )}
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
  disabled = false,
}: {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  disabled?: boolean;
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
        disabled={disabled}
        className={`w-full rounded-[10px] border border-[#d1dee8]/70 py-2.5 text-xs text-[#111111] outline-none transition-all placeholder:text-[#78716b]/60 focus:border-[#165dfb] focus:ring-4 focus:ring-[#165dfb]/10 focus:bg-white font-medium shadow-xs ${
          disabled
            ? "bg-[#f5f5f4] cursor-not-allowed opacity-75"
            : "bg-[#e6e3e2]/40"
        } ${icon ? "pl-9" : "pl-3"} ${rightSlot ? "pr-9" : "pr-3"}`}
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
    <div className="flex items-start justify-between gap-4 rounded-[10px] border border-[#d1dee8]/70 bg-[#e6e3e2]/40 px-4 py-3.5 transition-colors shadow-xs">
      <div className="flex-1 min-w-0 text-left">
        <p className="text-xs font-bold text-[#111111]">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((value) => !value)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none ${
          on ? "bg-[#165dfb]" : "bg-[#d1dee8]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function ProfilePanel({
  onSave,
  refreshSession,
  user,
}: {
  onSave: () => void;
  refreshSession: () => Promise<void>;
  user: any;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [program, setProgram] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    setFullName(
      user.fullName ||
        user.name ||
        `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    );
    setEmail(user.email || "");
    setInstitution(user.college || user.institution || "");
    setProgram(user.department || user.program || "");
    setPhone(user.phone || "");
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem("dynoquizz_token");

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const trimmedName = fullName.trim();

      if (!trimmedName) {
        throw new Error("Full name is required.");
      }

      const firstSpace = trimmedName.indexOf(" ");
      const firstName =
        firstSpace === -1
          ? trimmedName
          : trimmedName.slice(0, firstSpace).trim();
      const lastName =
        firstSpace === -1 ? "" : trimmedName.slice(firstSpace + 1).trim();

      const requestBody = {
        firstName,
        lastName,
        phone: phone.trim() || null,
        college: institution.trim() || null,
        department: program.trim() || null,
      };

      const res = await fetch(ENDPOINTS.user.profile, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to update profile (${res.status}).`,
        );
      }

      await refreshSession();
      onSave();
    } catch (e: any) {
      console.error("Profile update failed:", e);
      setError(e?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const initial = fullName.trim()
    ? fullName.trim().charAt(0).toUpperCase()
    : "U";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3.5 text-left">
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#165dfb] text-lg font-bold text-white shadow-xs">
            {initial}
          </div>

          <button
            type="button"
            disabled
            aria-label="Profile photo"
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f5f4] border border-[#d1dee8]/70 text-[#78716b] shadow-xs cursor-not-allowed opacity-70"
          >
            <User className="h-3 w-3 text-[#78716b]" />
          </button>
        </div>

        <div>
          <p className="text-xs font-bold text-[#111111]">Profile Photo</p>
          <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
            Profile image upload is not currently exposed by the backend UI.
          </p>
        </div>
      </div>

      <div className="h-px bg-[#d1dee8]/30" />

      {error && (
        <div className="flex items-center gap-2 rounded-[10px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold shadow-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full Name">
          <TextInput
            placeholder="Your full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            icon={<User className="h-4 w-4" />}
          />
        </Field>

        <Field
          label="Email Address"
          hint="Email is managed by your authenticated account."
        >
          <TextInput
            type="email"
            placeholder="you@university.edu"
            value={email}
            disabled
            icon={<Mail className="h-4 w-4" />}
          />
        </Field>

        <Field label="Institution / University">
          <TextInput
            placeholder="University"
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
          />
        </Field>

        <Field label="Course / Department">
          <TextInput
            placeholder="Department"
            value={program}
            onChange={(event) => setProgram(event.target.value)}
          />
        </Field>

        <Field label="Phone Number">
          <TextInput
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all cursor-pointer border-0 shadow-xs disabled:opacity-50"
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
            defaultChecked
          />
          <Toggle
            label="Email: Upcoming Assessments"
            description="Reminder 24 hours before a scheduled exam."
            defaultChecked
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

      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
          Appearance
        </h3>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              {
                id: "system",
                label: "System",
                icon: <Monitor className="h-4 w-4" />,
              },
              {
                id: "light",
                label: "Light",
                icon: <Eye className="h-4 w-4" />,
              },
              {
                id: "dark",
                label: "Dark",
                icon: <Moon className="h-4 w-4" />,
              },
            ] as const
          ).map((item) => {
            const isActive = theme === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                className={`flex flex-col items-center gap-1.5 rounded-[10px] border py-3 text-xs font-bold transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.98] ${
                  isActive
                    ? "border-[#165dfb] bg-[#165dfb]/5 text-[#165dfb] ring-2 ring-[#165dfb]/20"
                    : "border-[#d1dee8]/70 bg-white text-[#78716b] hover:border-[#165dfb]/40 hover:text-[#111111]"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all cursor-pointer border-0 shadow-xs"
        >
          <Save className="h-3.5 w-3.5" />
          Save Preferences
        </button>
      </div>
    </div>
  );
}

function SecurityPanel({ onSave }: { onSave: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setError(null);

    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("dynoquizz_token");

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const res = await fetch(ENDPOINTS.auth.changePassword, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to change password (${res.status}).`,
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSave();
    } catch (e: any) {
      console.error("Password change failed:", e);
      setError(e?.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
          Change Password
        </h3>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-[#fbeee8] border border-[#8c381c]/30 p-3 text-xs text-[#8c381c] font-semibold shadow-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3">
          <Field label="Current Password">
            <TextInput
              type={showCurrent ? "text" : "password"}
              placeholder="••••••••"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowCurrent((value) => !value)}
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
                >
                  {showCurrent ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
          </Field>

          <Field label="New Password" hint="Minimum 8 characters.">
            <TextInput
              type={showNew ? "text" : "password"}
              placeholder="••••••••"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowNew((value) => !value)}
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
                >
                  {showNew ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
          </Field>

          <Field label="Confirm New Password">
            <TextInput
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              icon={<Lock className="h-4 w-4" />}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowConfirm((value) => !value)}
                  className="text-[#78716b] hover:text-[#111111] cursor-pointer border-0 bg-transparent"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              }
            />
          </Field>
        </div>
      </div>

      <div className="h-px bg-[#d1dee8]/30" />

      <div>
        <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-[#78716b] text-left">
          Two-Factor Authentication
        </h3>

        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-[#d1dee8]/70 bg-[#e6e3e2]/40 p-3.5 text-left shadow-xs">
          <div>
            <p className="text-xs font-bold text-[#111111]">
              Authenticator App
            </p>
            <p className="mt-0.5 text-[10px] text-[#78716b] font-medium">
              Two-factor setup is not exposed by the current backend API.
            </p>
          </div>

          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded-[10px] border border-[#d1dee8]/70 bg-white px-3.5 py-1.5 text-xs font-bold text-[#78716b] cursor-not-allowed opacity-60 shadow-xs"
          >
            Unavailable
          </button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleChangePassword}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-[10px] bg-[#165dfb] px-4 py-2 text-xs font-bold text-white hover:bg-[#165dfb]/90 active:scale-[0.98] transition-all cursor-pointer border-0 shadow-xs disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}

function DangerPanel({ logout }: { logout: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CONFIRM_PHRASE = "delete my account";
  const ready = confirmText === CONFIRM_PHRASE && password.length > 0;

  const handleDeleteAccount = async () => {
    if (!ready) return;

    setDeleting(true);
    setError(null);

    try {
      const token = localStorage.getItem("dynoquizz_token");

      if (!token) {
        throw new Error("Authentication token not found. Please log in again.");
      }

      const res = await fetch(ENDPOINTS.auth.deleteAccount, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          body?.message ||
            body?.error ||
            `Failed to delete account (${res.status}).`,
        );
      }

      await logout();
    } catch (e: any) {
      console.error("Account deletion failed:", e);
      setError(e?.message || "Failed to delete account.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-[10px] border border-[#73561a]/20 bg-[#f6efe1] p-4 text-left shadow-xs">
        <div className="flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-[#73561a] border border-[#d1dee8]/70 shadow-xs">
            <LogOut className="h-4 w-4" />
          </div>

          <div>
            <p className="font-bold text-[#73561a] text-xs">Sign out</p>
            <p className="mt-0.5 text-[10px] text-[#73561a]/90 font-medium leading-normal">
              Clear this browser&apos;s active Quizly session.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="shrink-0 rounded-[10px] border border-[#73561a]/30 bg-white px-3 py-1.5 text-[10px] font-bold text-[#73561a] hover:bg-[#f6efe1]/30 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
        >
          Sign out
        </button>
      </div>

      <div className="rounded-[10px] border border-[#8c381c]/20 bg-[#fbeee8] p-4 text-left shadow-xs">
        <div className="mb-3 flex gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-[#8c381c] border border-[#d1dee8]/70 shadow-xs">
            <Trash2 className="h-4 w-4" />
          </div>

          <div>
            <p className="font-bold text-[#8c381c] text-xs">Delete Account</p>
            <p className="mt-0.5 text-[10px] text-[#8c381c]/90 font-medium leading-normal">
              Permanently delete your account through the backend account
              deletion endpoint. This action cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 flex items-center gap-2 rounded-[10px] bg-white/60 border border-[#8c381c]/20 p-3 text-xs text-[#8c381c] font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-[10px] font-bold text-[#8c381c]">
            Type{" "}
            <span className="rounded-[6px] bg-white px-1.5 py-0.5 font-mono text-[#8c381c] border border-[#8c381c]/20">
              {CONFIRM_PHRASE}
            </span>{" "}
            to confirm:
          </label>

          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-[10px] border border-[#8c381c]/30 bg-white px-3 py-2 text-xs text-[#8c381c] outline-none transition-colors placeholder:text-[#8c381c]/40 focus:border-[#8c381c]/75 font-medium shadow-xs"
          />

          <TextInput
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Current account password"
            icon={<Lock className="h-4 w-4" />}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="text-[#8c381c] hover:text-[#6e2b14] cursor-pointer border-0 bg-transparent"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            }
          />

          <button
            type="button"
            disabled={!ready || deleting}
            onClick={handleDeleteAccount}
            className={`flex w-full items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-xs font-bold transition-all duration-200 border-0 shadow-xs active:scale-[0.98] ${
              ready && !deleting
                ? "bg-[#8c381c] text-white hover:bg-[#8c381c]/90 cursor-pointer"
                : "cursor-not-allowed bg-[#fbeee8]/50 text-[#8c381c]/50"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {deleting ? "Deleting..." : "Permanently Delete My Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout, refreshSession } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const dashboardHref = user
    ? String(user.role || "").toUpperCase() === "TEACHER"
      ? "/dashboard/teacher"
      : "/dashboard/student"
    : "/";

  return (
    <div className="min-h-screen bg-[#f5f5f4] font-sans text-[#111111] flex overflow-hidden">
      <aside className="w-64 bg-[#f5f5f4] border-r border-[#d1dee8]/70 flex flex-col shrink-0">
        <div className="p-6 border-b border-[#d1dee8]/50">
          <Logo />
        </div>

        <nav className="flex-1 p-4 space-y-1 text-left">
          <Link
            href={dashboardHref}
            className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-xs font-bold text-[#78716b] hover:bg-[#e6e3e2] hover:text-[#111111] active:scale-[0.98] transition-all"
          >
            <LayoutDashboard className="h-4 w-4 text-[#78716b]" />
            Dashboard
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-[10px] px-3.5 py-2.5 text-xs font-bold bg-[#165dfb] text-white shadow-xs transition-all border-0"
          >
            <SettingsIcon className="h-4 w-4 text-white" />
            Settings
          </Link>
        </nav>

        <div className="p-4 border-t border-[#d1dee8]/50 text-left space-y-3">
          <div className="flex items-center gap-2.5 px-2.5 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e6e3e2] border border-[#d1dee8]/70 text-xs font-bold text-[#111111]">
              {user?.fullName || user?.name
                ? (user.fullName || user.name).charAt(0).toUpperCase()
                : "U"}
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold text-[#111111] truncate">
                {user?.fullName || user?.name || "User"}
              </p>
              <p className="text-[9px] text-[#78716b] font-medium uppercase">
                {user?.role || "Account"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 rounded-[10px] border border-[#d1dee8]/70 bg-white py-2 text-xs font-bold text-[#8c381c] hover:bg-[#fbeee8] active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="h-3.5 w-3.5 text-[#8c381c]" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-left">
        <section className="border-b border-[#d1dee8]/50 pb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#78716b]">
              Account Center
            </span>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#111111]">
              Settings
            </h1>
            <p className="mt-0.5 text-xs text-[#78716b] font-medium">
              Manage your profile, preferences, and account security.
            </p>
          </div>

          {saved && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#e2ede8] px-3 py-1 text-xs font-bold text-[#1d5237] border border-[#1d5237]/20 shadow-xs animate-bounce">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1d5237]" />
              Saved!
            </span>
          )}
        </section>

        <div className="flex flex-col gap-5 lg:flex-row items-start">
          <nav className="flex shrink-0 gap-1 overflow-x-auto rounded-[12px] bg-[#e6e3e2]/40 p-1.5 border border-[#d1dee8]/70 lg:w-44 lg:flex-col lg:overflow-x-visible shadow-xs">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-w-max items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-bold transition-all duration-150 lg:w-full cursor-pointer border-0 active:scale-[0.98] ${
                  activeTab === id
                    ? id === "danger"
                      ? "bg-[#fbeee8] text-[#8c381c] shadow-xs"
                      : "bg-[#165dfb] text-white shadow-xs"
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

          <div className="flex-1 w-full rounded-[14px] bg-white p-6 border border-[#d1dee8]/70 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "profile" && (
                  <ProfilePanel
                    onSave={handleSave}
                    refreshSession={refreshSession}
                    user={user}
                  />
                )}

                {activeTab === "preferences" && (
                  <PreferencesPanel onSave={handleSave} />
                )}

                {activeTab === "security" && (
                  <SecurityPanel onSave={handleSave} />
                )}

                {activeTab === "danger" && <DangerPanel logout={logout} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
