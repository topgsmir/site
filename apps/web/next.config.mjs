import process from "node:process";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Test builds use an isolated, ignored output directory alongside the active dev server.
  distDir: process.env.TOPGSM_NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  htmlLimitedBots: /.*/,
  typedRoutes: true
};

export default nextConfig;
