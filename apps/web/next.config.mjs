/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const isDev = !isProd;

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const requiredCspEnv = ['CSP_API_DOMAIN', 'CSP_CDN_DOMAIN', 'CSP_ANALYTICS_DOMAIN'];
if (isProd) {
  const missing = requiredCspEnv.filter((key) => !process.env[key] || !String(process.env[key]).trim());
  if (missing.length) {
    throw new Error(`Missing CSP allowlist env vars in production: ${missing.join(', ')}`);
  }
}

const apiDomain = process.env.CSP_API_DOMAIN || 'api.example.com';
const cdnDomain = process.env.CSP_CDN_DOMAIN || 'cdn.example.com';
const analyticsDomain = process.env.CSP_ANALYTICS_DOMAIN || 'analytics.example.com';

const connectExtras = parseList(process.env.CSP_CONNECT_SRC_EXTRA);
const scriptExtras = parseList(process.env.CSP_SCRIPT_SRC_EXTRA);
const imgExtras = parseList(process.env.CSP_IMG_SRC_EXTRA);

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "form-action 'self'",
  `img-src 'self' data: blob: https://${cdnDomain} ${imgExtras.join(' ')}`.trim(),
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self'${isDev ? " 'unsafe-eval'" : ''} 'unsafe-inline' https://${analyticsDomain} ${scriptExtras.join(' ')}`.trim(),
  `connect-src 'self' https:${isDev ? ' ws:' : ''} https://${apiDomain} https://${analyticsDomain} ${connectExtras.join(' ')}`.trim(),
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: [
    '@nextgen/ui',
    '@nextgen/types',
    '@nextgen/auth',
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('onnxruntime-node');
    } else {
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        'onnxruntime-node': false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
