import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist requires canvas to be aliased to false in server/webpack contexts
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, unknown>),
      canvas: false,
      encoding: false,
    };
    return config;
  },
};

export default nextConfig;
