/**
 * Runtime frontend mode.
 *
 * Set NEXT_PUBLIC_EXAM_MODE=LAN for the local exam environment.
 */
const configuredMode = String(process.env.NEXT_PUBLIC_EXAM_MODE ?? "")
  .trim()
  .toUpperCase();

export function isLanExamMode(): boolean {
  return configuredMode === "LAN" || configuredMode === "OFFLINE_LAN";
}
