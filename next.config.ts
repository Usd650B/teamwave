import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
         protocol: 'https',
         hostname: 'lh3.googleusercontent.com', // For Google profile photos
      }
    ],
  },
};

export default nextConfig;
