import type { NextConfig } from "next";

const configuredOrigins = String(process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const configuredMode = String(process.env.NEXT_PUBLIC_EXAM_MODE ?? "")
  .trim()
  .toUpperCase();
const isLanMode = configuredMode === "LAN" || configuredMode === "OFFLINE_LAN";

// LAN mode uses a server-side rewrite to reach the backend on the local network.
// Online mode is handled by app/backend/[...path]/route.ts, which also adds the
// ngrok bypass header when the configured upstream requires it.
const apiTarget = String(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : ["localhost:3000"],
  async rewrites() {
    if (!isLanMode) return [];

    return [
      {
        source: "/backend/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
