import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // Panchayat boundaries are a large static file (scripts/export_web_data.py); serve it from the CDN.
    return [{ source: "/api/v1/panchayats", destination: "/data/panchayats.geojson" }];
  },
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [
          { key: "Content-Type", value: "application/geo+json" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
