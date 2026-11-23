import { EmptyState, LinkButton, PublicShell } from '@/design';

/** X50, refonte Chrono (D-156) : message uniforme, aucune donnée, retour à la liste autorisée. */
export default function NotFound() {
  return (
    <PublicShell home="/choose-workspace">
      <h1 className="ds-visually-hidden">Page indisponible</h1>
      <EmptyState icon="info" title="Page indisponible" action={<LinkButton href="/choose-workspace" variant="primary">Revenir à mes espaces</LinkButton>}>
        Cette page n’existe pas ou n’est pas accessible avec ce compte.
      </EmptyState>
    </PublicShell>
  );
}
