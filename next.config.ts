import type { NextConfig } from "next";

const LEGAL_REDIRECTS = ["terms", "privacy", "refunds", "methodology"].map(
  (page) => ({
    source: `/${page}`,
    destination: `/${page}.html`,
    permanent: true,
  })
);

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return LEGAL_REDIRECTS;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
