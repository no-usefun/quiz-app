type LoadingIndicatorProps = {
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<LoadingIndicatorProps["size"]>, string> = {
  sm: "h-3 w-16",
  md: "h-3.5 w-24",
  lg: "h-4 w-36",
};

/**
 * Compatibility wrapper for existing pending states. Shows a shimmer bar
 * rather than a rotating circle; page-level loading should use content-shaped
 * skeletons so the actual page structure stays visible.
 */
export default function LoadingIndicator({
  label,
  size = "md",
  className = "",
}: LoadingIndicatorProps) {
  return (
    <span
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`inline-flex items-center justify-center ${className}`.trim()}
    >
      <span aria-hidden="true" className={`quizly-skeleton rounded-md ${sizeClasses[size]}`} />
    </span>
  );
}
