import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev badge sits on top of the film's frame.
  devIndicators: false,
  // Let phones and other computers on the same Wi-Fi open the dev server.
  allowedDevOrigins: ["192.168.*.*", "yogendras-macbook-pro.local", "*.local"],
};

export default nextConfig;
