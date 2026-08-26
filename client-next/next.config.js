/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Deployment ────────────────────────────────────────────────────────────
  // 'standalone' bundles only the required node_modules for server deployment.
  // This is what pm2 should point at: node .next/standalone/server.js
  output: 'standalone',

  // Don't expose the Next.js version in response headers
  poweredByHeader: false,

  // ── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prevent MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referrer info sent to other sites
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Basic XSS protection for older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

