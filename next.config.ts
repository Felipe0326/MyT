import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  /*
   * React necesita unsafe-eval únicamente durante npm run dev
   * para mostrar errores y reconstruir call stacks.
   */
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
].join(" ");

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "style-src-attr 'unsafe-inline'",
  `script-src ${scriptSources}`,
  "script-src-attr 'none'",
  "connect-src 'self' https://lowcode.morelos.gob.mx",
  /*
   * No se agrega en local para evitar que HTTP localhost
   * se intente convertir en HTTPS.
   */
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "Origin-Agent-Cluster",
    value: "?1",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-store, max-age=0",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,

  turbopack: {
    root: process.cwd(),
  },

  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/auth/:path*",
        headers: noStoreHeaders,
      },
      {
        source: "/api/admin/:path*",
        headers: noStoreHeaders,
      },
    ];
  },
};

export default nextConfig;