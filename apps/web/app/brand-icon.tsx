import { ImageResponse } from 'next/og';

/** CE-E-06 (D-070) : icône de l’application installée, dessinée à la volée (aucune image ni bibliothèque à ajouter). */
/** maskable : marge de sécurité (Android) ; square : coins droits (iPhone arrondit lui-même). */
export function brandIcon(size: number, maskable = false, square = false): ImageResponse {
  const pad = maskable ? size * 0.18 : 0; // zone de sécurité des icônes « maskable » (Android)
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a6452', borderRadius: maskable || square ? 0 : size * 0.22 }}>
        <div style={{ display: 'flex', fontSize: (size - pad * 2) * 0.62, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>↗</div>
      </div>
    ),
    { width: size, height: size },
  );
}
