import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@spain/i18n',
    '@spain/communications',
    '@spain/domain',
    '@spain/observability',
    '@spain/ui',
  ],
};

export default nextConfig;
