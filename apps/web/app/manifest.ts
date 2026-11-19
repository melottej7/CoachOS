import type { MetadataRoute } from 'next';

/**
 * CE-E-06 (D-070) : CoachOS s’installe sur l’écran d’accueil du téléphone et s’ouvre en plein écran.
 * L’adresse de départ renvoie chacun vers son espace (coach ou élève) après connexion.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoachOS',
    short_name: 'CoachOS',
    description: 'Tes séances, tes retours et ton coach, au même endroit.',
    lang: 'fr-BE',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f1d24',
    theme_color: '#0a6452',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
