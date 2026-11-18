/**
 * Le guide CoachOS : personnage original en tenue de sport, aux couleurs de l’espace (accent).
 * Décoratif pour les lecteurs d’écran : le texte de la bulle porte toute l’information.
 * Animations (signe de la main, clignement, bouche qui parle) désactivées si le mouvement est réduit.
 */
export type MascotMood = 'happy' | 'wink' | 'cheer';
export type MascotPose = 'wave' | 'point-up' | 'point-down' | 'rest';

const SKIN = '#f2c9a5';
const HAIR = '#3a2a22';
const LINE = '#1d2b33';
const SHORTS = '#2f4858';

/** Bras dessiné vers la droite depuis l’épaule, puis tourné. */
function Arm({ x, angle, className, point }: { x: number; angle: number; className?: string; point?: boolean }) {
  return (
    <g className={className} style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${x}px 66px`, transformBox: 'view-box' }}>
      <line x1={x} y1="66" x2={x + 21} y2="66" stroke={LINE} strokeWidth="9" strokeLinecap="round" />
      <line x1={x} y1="66" x2={x + 21} y2="66" stroke={SKIN} strokeWidth="6.5" strokeLinecap="round" />
      <line x1={x} y1="66" x2={x + 8} y2="66" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round" />
      <circle cx={x + 23} cy="66" r="4.6" fill={SKIN} stroke={LINE} strokeWidth="1.3" />
      {point ? <line x1={x + 26} y1="66" x2={x + 31} y2="66" stroke={SKIN} strokeWidth="3" strokeLinecap="round" /> : null}
    </g>
  );
}

function Face({ mood, talking }: { mood: MascotMood; talking?: boolean }) {
  return (
    <>
      {/* tête, cheveux, bandeau */}
      <circle cx="50" cy="38" r="19" fill={SKIN} stroke={LINE} strokeWidth="1.5" />
      <path d="M31.5 35 Q33 17 50 17 Q67 17 68.5 35 Q60 26 50 27 Q40 26 31.5 35 Z" fill={HAIR} />
      <path d="M31 31 Q50 23 69 31 L69 37 Q50 29 31 37 Z" fill="var(--accent)" stroke={LINE} strokeWidth="1" />
      <path d="M68 32 l9 -4 l-3 8 z M68 35 l10 2 l-7 5 z" fill="var(--accent)" stroke={LINE} strokeWidth="0.8" />
      {/* yeux */}
      <g className="m-eyes">
        <ellipse cx="43" cy="42" rx="2.3" ry="2.8" fill={LINE} />
        {mood === 'wink'
          ? <path d="M54.5 42 q2.5 -2.5 5 0" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
          : <ellipse cx="57" cy="42" rx="2.3" ry="2.8" fill={LINE} />}
      </g>
      <circle cx="38.5" cy="48" r="2.6" fill="#e8907a" opacity="0.45" />
      <circle cx="61.5" cy="48" r="2.6" fill="#e8907a" opacity="0.45" />
      {/* bouche */}
      {talking ? (
        <ellipse className="m-talk" cx="50" cy="50.5" rx="4" ry="3" fill={LINE} />
      ) : mood === 'cheer' ? (
        <path d="M44 48.5 q6 8 12 0 z" fill={LINE} />
      ) : (
        <path d="M45 49 q5 4.5 10 0" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
    </>
  );
}

/** Personnage en pied (visite guidée). */
export function Mascot({ size = 72, mood = 'happy', pose = 'rest', talking = false, full = false }: {
  size?: number; mood?: MascotMood; pose?: MascotPose; talking?: boolean; full?: boolean;
}) {
  if (!full) {
    // Buste seul pour les petits emplacements (bouton, bulles des assistants).
    return (
      <svg width={size} height={size} viewBox="26 14 48 48" aria-hidden="true" focusable="false" className="mascot">
        <circle cx="50" cy="38" r="23.5" fill="var(--mint)" />
        <Face mood={mood} />
      </svg>
    );
  }
  const right = pose === 'point-up' ? -42 : pose === 'point-down' ? 38 : pose === 'wave' || mood === 'cheer' ? -55 : 78;
  const left = mood === 'cheer' ? -138 : 102;
  return (
    <svg width={size} height={size * 1.45} viewBox="0 0 100 145" aria-hidden="true" focusable="false" className={`mascot full pose-${pose}`}>
      <ellipse cx="50" cy="140" rx="24" ry="4" fill="#000" opacity="0.18" />
      {/* jambes et chaussures */}
      <rect x="40" y="108" width="8" height="27" rx="4" fill={SKIN} stroke={LINE} strokeWidth="1.3" />
      <rect x="52" y="108" width="8" height="27" rx="4" fill={SKIN} stroke={LINE} strokeWidth="1.3" />
      <path d="M36 134 h13 a3 3 0 0 1 0 6 h-13 a3 3 0 0 1 0 -6 z" fill="#fff" stroke={LINE} strokeWidth="1.3" />
      <path d="M51 134 h13 a3 3 0 0 1 0 6 h-13 a3 3 0 0 1 0 -6 z" fill="#fff" stroke={LINE} strokeWidth="1.3" />
      <path d="M39 137 h6 M54 137 h6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      {/* short et maillot */}
      <path d="M36 96 h28 l2 16 h-13 l-3 -6 l-3 6 h-13 z" fill={SHORTS} stroke={LINE} strokeWidth="1.3" />
      <path d="M34 63 Q50 57 66 63 L64 99 Q50 102 36 99 Z" fill="var(--accent)" stroke={LINE} strokeWidth="1.5" />
      <path d="M44 61 Q50 66 56 61" stroke={LINE} strokeWidth="1.3" fill="none" />
      <circle cx="50" cy="79" r="7" fill="#fff" stroke={LINE} strokeWidth="1" />
      <path d="M46.5 82.5 L53 76 M48.5 76 H53 V80.5" stroke="var(--accent)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* bras */}
      <Arm x={34} angle={left} className={mood === 'cheer' ? 'm-cheer' : undefined} />
      <Arm x={66} angle={right} className={pose === 'wave' ? 'm-wave' : undefined} point={pose === 'point-up' || pose === 'point-down'} />
      {/* cou et tête */}
      <rect x="46" y="54" width="8" height="8" fill={SKIN} stroke={LINE} strokeWidth="1.2" />
      <Face mood={mood} talking={talking} />
    </svg>
  );
}

/** Le guide qui parle : bulle de texte à côté du personnage. */
export function MascotSays({ children, mood }: { children: React.ReactNode; mood?: MascotMood }) {
  return (
    <div className="mascot-says">
      <Mascot mood={mood} full pose="wave" size={56} />
      <div className="bubble">{children}</div>
    </div>
  );
}
