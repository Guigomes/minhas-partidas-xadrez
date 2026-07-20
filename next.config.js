/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },

  webpack(config) {
    config.resolve.symlinks = false;
    return config;
  },
};

module.exports = nextConfig;
