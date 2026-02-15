/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@booking-os/shared'],
  output: 'standalone',
};

module.exports = nextConfig;
