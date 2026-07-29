import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Pruned from opslin-dashboard's CSP: no Razorpay entries at all — billing
// checkout is a dashboard-only feature, never reachable from this app.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
  "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${API_URL} https://cloudflareinsights.com wss: ws:`,
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["admin.opslin.com"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: contentSecurityPolicy,
        },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
