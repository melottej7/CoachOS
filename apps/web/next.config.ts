import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite charge ses fichiers WASM depuis node_modules : ne pas le bundler.
  serverExternalPackages: ['@electric-sql/pglite'],
  transpilePackages: ['@coachos/domain'],
  poweredByHeader: false,
};

export default nextConfig;
