import Link from 'next/link';
import { WORKOUT_STATUS_LABELS, type WorkoutStatus } from '@coachos/domain';
import { demoAuthEnabled } from '@/server/auth/session';

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <span className="mark" aria-hidden="true">↗</span>CoachOS
    </Link>
  );
}

export function StatusBadge({ status }: { status: WorkoutStatus }) {
  const tone = status === 'published' ? '' : status === 'changed' ? 'attn' : 'neutral';
  return <span className={`pill ${tone}`}>{WORKOUT_STATUS_LABELS[status]}</span>;
}

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

/** Confirmation après redirection (?notice=…). Région polie ; ne remplace jamais une erreur de champ. */
export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="banner ok" role="status" style={{ marginBottom: 16 }}>
      {message}
    </p>
  );
}

export function TopBar({ home, children }: { home: string; children?: React.ReactNode }) {
  return (
    <header className="top">
      <Brand href={home} />
      <div className="top-meta">
        {children}
        {demoAuthEnabled() ? (
          <>
            <span className="demo-tag">Données fictives</span>
            <Link href="/demo">Changer d’identité</Link>
          </>
        ) : null}
        <form action="/auth/signout" method="post">
          <button type="submit" className="link-btn">Se déconnecter</button>
        </form>
      </div>
    </header>
  );
}
