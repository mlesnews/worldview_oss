import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack (Next 16 default) with resolve aliases
  turbopack: {
    resolveAlias: {
      // Cesium static assets are handled by scripts/copy-cesium.mjs
    },
  },
  // Silence large page data warnings from Cesium
  experimental: {
    largePageDataBytes: 512 * 1000,
  },
};

export default nextConfig;
