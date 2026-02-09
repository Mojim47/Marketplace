const DEFAULT_API_TARGET = 'http://localhost:4000'

function normalizeTarget(value = '') {
  try {
    const url = new URL(value || DEFAULT_API_TARGET)
    url.pathname = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return DEFAULT_API_TARGET
  }
}

const apiTarget = normalizeTarget(process.env.ADMIN_API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_BASE)

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    typedRoutes: true
  },
  webpack(config) {
    config.resolve = config.resolve || {}
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
      ...(config.resolve.extensionAlias || {})
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: `${apiTarget}/v1/:path*`
      }
    ]
  }
}

export default nextConfig
