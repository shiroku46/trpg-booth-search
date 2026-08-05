import type { NextConfig } from "next";

const previewSecurityHeaders = [
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, noimageindex",
  },
] as const;

const config: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...previewSecurityHeaders],
      },
    ];
  },
};

export default config;
