/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  experimental: {
    optimizePackageImports: [
      "@deck.gl/react",
      "@deck.gl/layers",
      "@deck.gl/geo-layers",
      "@deck.gl/core",
      "react-leaflet",
    ],
  },
};

export default nextConfig;
