// Restes de l’ancien kit encore utilisés par des écrans pas encore refaits (programme d’un objectif, D-123).

export function Pill({ children, tone = '' }: { children: React.ReactNode; tone?: '' | 'attn' | 'neutral' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
