import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  }
};

export default (phase) => ({
  ...nextConfig,
  // Keep `next build` from replacing chunks used by a running dev server.
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
});
