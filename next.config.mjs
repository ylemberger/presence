/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["@hebcal/core"],
  },
};

export default nextConfig;
