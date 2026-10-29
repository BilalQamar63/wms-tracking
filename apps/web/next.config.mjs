/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Shared workspace package is shipped as TypeScript source.
  transpilePackages: ['@wms/shared'],
  experimental: {
    // Native / Node-only packages must not be bundled by webpack.
    serverComponentsExternalPackages: ['mongoose', 'exceljs', 'bcryptjs', 'cloudinary'],
  },
};

export default nextConfig;
