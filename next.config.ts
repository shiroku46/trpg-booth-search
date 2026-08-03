import type { NextConfig } from "next";

const config: NextConfig = {
  // Next.js 16.2.11 still loads the TypeScript JavaScript API internally,
  // while the project contract requires TypeScript 7's CLI. CI therefore
  // performs the strict TS 7 check before this build and disables only the
  // duplicate framework check; the compatibility package is build-internal.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default config;
