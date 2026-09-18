import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enterprise CDN Image Optimization
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400, // Cache on Edge CDN for 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
