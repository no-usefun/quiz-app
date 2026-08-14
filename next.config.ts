import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add the IP address from your error message here
  allowedDevOrigins: ["172.20.32.53", "localhost:3000"],

  // Keep any other existing configuration you might have below...
};

export default nextConfig;
