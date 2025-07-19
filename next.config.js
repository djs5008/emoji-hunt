/**
 * Next.js Configuration
 * 
 * @description Configuration for the Next.js framework with custom settings
 * for the emoji-hunt game. Optimized for edge runtime compatibility.
 * 
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // Enable React's strict mode for better development warnings
  // Helps catch unsafe lifecycles, legacy API usage, and other issues
  reactStrictMode: true,
  
  experimental: {
    serverActions: {
      // Increase body size limit for server actions to 2MB
      // Needed for handling larger game state updates and canvas data
      bodySizeLimit: '2mb',
    },
  },
  
  /**
   * Webpack configuration customization
   * 
   * @description Modifies webpack config for edge runtime compatibility.
   * Edge runtime doesn't support Node.js built-in modules, so we disable
   * them to prevent build errors when deploying to Vercel Edge Functions.
   */
  webpack: (config, { isServer, nextRuntime }) => {
    // Only apply these aliases when building for edge runtime
    if (isServer && nextRuntime === 'edge') {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Disable Node.js built-in modules that aren't available in edge runtime
        stream: false,      // Node streams API
        crypto: false,      // Node crypto module
        dns: false,         // DNS operations
        net: false,         // Network operations
        tls: false,         // TLS/SSL operations
        fs: false,          // File system operations
        os: false,          // Operating system utilities
        path: false,        // Path utilities
        string_decoder: false, // String decoding utilities
      };
    }
    return config;
  },
};

module.exports = nextConfig;
