/**
 * Next.js proxy — rate limiting for API routes.
 * Protects /api/tadabbur from excessive usage.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLimiter } from "@/lib/rate-limiter";

export function proxy(request: NextRequest) {
  // Only rate-limit the tadabbur API endpoint
  if (request.method !== "POST") return NextResponse.next();
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/tadabbur")) return NextResponse.next();

  // Extract client IP from headers (works behind reverse proxies)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    realIp?.trim() ??
    "127.0.0.1";

  const result = defaultLimiter.check(ip);

  if (!result.allowed) {
    const retryAfter = Math.ceil(result.resetInMs / 1000);
    return new NextResponse(
      JSON.stringify({
        error: "Too many requests. Please wait before sending another request.",
        retryAfterSeconds: retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  // Attach remaining limit info to response headers
  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Remaining", String(result.remaining));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
