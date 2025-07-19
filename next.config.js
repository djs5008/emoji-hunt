/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        stream: false,
        crypto: false,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        os: false,
        path: false,
        string_decoder: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
