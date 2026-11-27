import type { MetadataRoute } from 'next';

/**
 * CE-E-06 (D-070) : CoachOS s’installe sur l’écran d’accueil du téléphone et s’ouvre en plein écran.
 * L’adresse de départ renvoie chacun vers son espace (coach ou élève) après connexion ; « / » est la page publique (D-174).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CoachOS',
    short_name: 'CoachOS',
    description: 'Tes séances, tes retours et ton coach, au même endroit.',
    lang: 'fr-BE',
    start_url: '/choose-workspace',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E1116',
    theme_color: '#0E1116',
    icons: [
      { src: '/icons/192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
