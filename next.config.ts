import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Only used by the development server. Playwright may connect through
  // 127.0.0.1 while Next binds localhost; allow both local loopback hosts
  // so client assets hydrate in the end-to-end visual audit.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
}

export default nextConfig
