import type { NextConfig } from "next";

const configuredOrigins = String(process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Route /backend/* through the same Next.js App Router proxy in both LAN and
// ONLINE modes. The proxy reads NEXT_PUBLIC_API_URL at the server and applies
// the same request/response handling to either upstream. Do not add a LAN-only
// rewrite here: rewrites run before filesystem route handlers and would bypass
// the shared proxy, producing different behavior in LAN and ONLINE mode.

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : ["localhost:3000"],
};

export default nextConfig;
