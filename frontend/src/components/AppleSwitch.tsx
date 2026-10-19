"use client";

type AppleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Shared Apple-style on/off switch.
 * The track is a capsule; the inset white thumb is a rounded rectangle,
 * matching the macOS System Settings control rather than a circular knob.
 */
export function AppleSwitch({
  checked,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
}: AppleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-7 w-[60px] shrink-0 items-center rounded-full border-0 p-0 transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 " +
        (checked ? "bg-[#007aff]" : "bg-[#d1d1d6]") +
        " " +
        className
      }
    >
      <span
        aria-hidden="true"
        className={
          "pointer-events-none absolute left-[3px] top-1 h-5 w-[34px] rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] transition-transform duration-200 ease-in-out " +
          (checked ? "translate-x-[20px]" : "translate-x-0")
        }
      />
    </button>
  );
}
