import { ImageResponse } from 'next/og';

/**
 * Icône de l’application installée, dessinée à la volée (aucune image à gérer).
 * D-185 : un chrono blanc, le premier quart en orange (palette Chrono), sur fond encre.
 * maskable : marge de sécurité (Android) ; square : coins droits (iPhone arrondit lui-même).
 */
export const BRAND_INK = '#0E1116';
export const BRAND_SIGNAL = '#FF5A1F';

export function brandIcon(size: number, maskable = false, square = false): ImageResponse {
  const mark = maskable ? size * 0.72 : size; // zone de sécurité des icônes « maskable » (Android)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND_INK, borderRadius: maskable || square ? 0 : size * 0.22 }}>
        <svg width={mark} height={mark} viewBox="0 0 100 100">
          <rect x="44" y="14" width="12" height="9" rx="2" fill="#ffffff" />
          <circle cx="50" cy="54" r="26" fill="none" stroke="#ffffff" strokeWidth="8" />
          <path d="M50 28A26 26 0 0 1 76 54" fill="none" stroke={BRAND_SIGNAL} strokeWidth="8" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
