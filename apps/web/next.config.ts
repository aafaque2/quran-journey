import path from "node:path";
import type { NextConfig } from "next";

// The app always runs from apps/web, so the workspace root is two levels up.
const repoRoot = path.resolve(process.cwd(), "..", "..");

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@quran-journey/schema", "@quran-journey/content"],
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  poweredByHeader: false,
};

export default nextConfig;
