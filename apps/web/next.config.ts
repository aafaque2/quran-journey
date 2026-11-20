import path from "node:path";
import type { NextConfig } from "next";

// The app always runs from apps/web, so the workspace root is two levels up.
const repoRoot = path.resolve(process.cwd(), "..", "..");

// Conservative security headers. (No CSP yet: the pre-paint preference script in <head> is inline.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@quran-journey/schema", "@quran-journey/content"],
  outputFileTracingRoot: repoRoot,
  // Pages are pre-rendered at build time, but /internal-review reads content/ on each request:
  // ship those files with its serverless function.
  outputFileTracingIncludes: { "/internal-review": ["../../content/**/*"] },
  turbopack: { root: repoRoot },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker must always be re-checked, or installed apps would keep an old version.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
};

export default nextConfig;
