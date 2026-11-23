import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // D-125 · Les tests de bout en bout ont leur propre dossier de construction : ils ne touchent jamais au serveur de développement.
  distDir: process.env.COACHOS_DIST_DIR || '.next',
  // PGlite charge ses fichiers WASM depuis node_modules : ne pas le bundler.
  serverExternalPackages: ['@electric-sql/pglite'],
  transpilePackages: ['@coachos/domain'],
  poweredByHeader: false,
  // D-113 · La construction de production ne vérifie pas les fichiers de test : l’outil de test (vitest) n’est pas
  // installé sur Vercel. Les tests restent vérifiés en local (npm run typecheck utilise tsconfig.json).
  typescript: { tsconfigPath: 'tsconfig.build.json' },
  // Développement seulement : un téléphone sur le même Wi-Fi ouvre l’adresse réseau du Mac (« Network: http://… »).
  // Next.js bloque par défaut ces origines (rechargement en direct, morceaux de page) : on autorise les réseaux privés.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*', '*.local'],
  // Développement seulement : la feuille de styles garde la même adresse quand son contenu change,
  // et Safari réutilisait sa copie en mémoire (pages « sans style »). On interdit toute conservation.
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return [{ source: '/_next/static/:path*', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] }];
    }
    return [{ source: '/(.*)', headers: securityHeaders() }];
  },
};

/**
 * D-116 · En-têtes de sécurité hors développement : jamais dans un cadre d’un autre site, pas de devinette de type,
 * adresse de la page non transmise aux autres sites, https imposé un an, capteurs réservés à l’app elle-même
 * (le micro sert aux vocaux). Pas de règle sur les scripts : Next.js en injecte en ligne, une règle stricte casserait l’app.
 */
export function securityHeaders(): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
  ];
}

export default nextConfig;
