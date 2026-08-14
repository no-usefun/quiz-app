import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: ["172.20.32.53", "localhost:3000"],
};

export default nextConfig;

