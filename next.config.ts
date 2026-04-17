import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.telegram.org",
      },
    ],
  },
};

export default nextConfig;
