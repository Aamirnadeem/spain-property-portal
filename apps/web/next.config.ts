import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@spain/i18n',
    '@spain/communications',
    '@spain/domain',
    '@spain/observability',
    '@spain/ui',
    '@spain/search',
    '@spain/database',
  ],
};

export default nextConfig;
