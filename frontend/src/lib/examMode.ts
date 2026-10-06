/**
 * Runtime frontend mode.
 *
 * Set NEXT_PUBLIC_EXAM_MODE=LAN for the local exam environment.
 */
const configuredMode = String(process.env.NEXT_PUBLIC_EXAM_MODE ?? "")
  .trim()
  .toUpperCase();

export const isLanExamMode =
  configuredMode === "LAN" || configuredMode === "OFFLINE_LAN";
