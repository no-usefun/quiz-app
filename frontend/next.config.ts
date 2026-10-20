import type { NextConfig } from "next";

const configuredOrigins = String(process.env.ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins:
    configuredOrigins.length > 0 ? configuredOrigins : ["localhost:3000"],
};

export default nextConfig;
