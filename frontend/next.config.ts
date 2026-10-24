import type { NextConfig } from "next";

const configuredOrigins = String(process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Use the configured Spring Boot API as the upstream for /backend requests.
// This works for both LAN and online mode without exposing a different browser origin.
const apiTarget = String(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : ["localhost:3000"],
  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
