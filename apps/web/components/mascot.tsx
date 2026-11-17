/**
 * « Allure », avatar original de CoachOS : un visage rond et souriant avec un bandeau de sport.
 * Couleurs du design system (clair et sombre), purement décoratif pour les lecteurs d’écran.
 */
export function Mascot({ size = 72, mood = 'happy' }: { size?: number; mood?: 'happy' | 'wink' | 'cheer' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true" focusable="false" className="mascot">
      <circle cx="36" cy="38" r="30" fill="var(--mint)" stroke="var(--accent)" strokeWidth="3" />
      {/* bandeau */}
      <path d="M9 30 Q36 18 63 30 L62 37 Q36 26 10 37 Z" fill="var(--accent)" />
      <path d="M60 31 l9 -5 l-2 9 z" fill="var(--accent)" />
      {/* yeux */}
      <circle cx="27" cy="43" r="3.4" fill="var(--mint-ink)" />
      {mood === 'wink' ? (
        <path d="M41 43 q4 -3 8 0" stroke="var(--mint-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <circle cx="45" cy="43" r="3.4" fill="var(--mint-ink)" />
      )}
      {/* joues */}
      <circle cx="21" cy="50" r="3.2" fill="var(--accent)" opacity="0.25" />
      <circle cx="51" cy="50" r="3.2" fill="var(--accent)" opacity="0.25" />
      {/* sourire */}
      {mood === 'cheer' ? (
        <path d="M27 52 q9 10 18 0 z" fill="var(--mint-ink)" />
      ) : (
        <path d="M28 53 q8 7 16 0" stroke="var(--mint-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** L’avatar qui parle : bulle de texte à côté du visage. */
export function MascotSays({ children, mood }: { children: React.ReactNode; mood?: 'happy' | 'wink' | 'cheer' }) {
  return (
    <div className="mascot-says">
      <Mascot mood={mood} />
      <div className="bubble">{children}</div>
    </div>
  );
}
