import { NextResponse } from "next/server";

const proxyResponseHeaders = {
  "Referrer-Policy": "no-referrer",
} as const;

export function proxy() {
  const response = NextResponse.next();

  for (const [key, value] of Object.entries(proxyResponseHeaders))
    response.headers.set(key, value);

  return response;
}

export const config = {
  matcher: "/:path*",
};
