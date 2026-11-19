import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PGlite charge ses fichiers WASM depuis node_modules : ne pas le bundler.
  serverExternalPackages: ['@electric-sql/pglite'],
  transpilePackages: ['@coachos/domain'],
  poweredByHeader: false,
  // Développement seulement : la feuille de styles garde la même adresse quand son contenu change,
  // et Safari réutilisait sa copie en mémoire (pages « sans style »). On interdit toute conservation.
  async headers() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] }];
  },
};

export default nextConfig;
