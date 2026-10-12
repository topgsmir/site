import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Test builds use an isolated, ignored output directory alongside the active dev server.
  distDir: process.env.TOPGSM_NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  htmlLimitedBots: /.*/,
  typedRoutes: true,
  experimental: { globalNotFound: true }
};

export default nextConfig;
