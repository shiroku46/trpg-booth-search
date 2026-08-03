import type { NextConfig } from "next";

const config: NextConfig = {
  // TypeScript 7 is checked explicitly by the preceding `npm run typecheck`
  // gate. Next.js 16.2.11 cannot resolve the platform-split TypeScript 7
  // package during its duplicate built-in check, so the build step delegates
  // only that duplicate check while retaining the independent strict gate.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;
