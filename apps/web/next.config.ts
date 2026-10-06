import type { NextConfig } from 'next';

/**
 * SBA_PREVIEW=1 produces a static export for the public GitHub Pages preview
 * (demo data only, no server). Static hosting cannot send headers or run
 * src/proxy.ts, so the CSP and security headers below apply only to the real,
 * server-rendered deployment.
 */
const isPreview = process.env.SBA_PREVIEW === '1';
const isDemo = process.env.SBA_DEMO === '1';

const securityHeaders = [
  {
    source: '/:path*',
    headers: [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ],
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SBA_PREVIEW: isPreview ? '1' : '0',
    NEXT_PUBLIC_SBA_DEMO: isDemo ? '1' : '0',
  },
  ...(isPreview
    ? {
        output: 'export',
        basePath: process.env.SBA_PREVIEW_BASE_PATH ?? '/General-booking',
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {
        // The Content-Security-Policy carries a per-request nonce: see src/proxy.ts.
        headers: () => Promise.resolve(securityHeaders),
      }),
};

export default nextConfig;
