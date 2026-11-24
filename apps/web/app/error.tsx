'use client';

import { useEffect } from 'react';
import { Button, Cluster, Heading, LinkButton, PublicShell, Stack, Text } from '@/design';

/**
 * D-117, refonte Chrono (D-156) · Erreur inattendue d’une page : message en français, aucun détail technique à l’écran.
 * « Réessayer » recharge la page ; la référence (digest) permet de retrouver l’erreur dans le journal du serveur.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ module: 'page', code: 'UNEXPECTED', digest: error.digest ?? null }));
  }, [error]);
  return (
    <PublicShell home="/choose-workspace">
      <Stack gap={4}>
        <Heading level={1} size={1}>Un problème est survenu</Heading>
        <Text muted>La page n’a pas pu s’afficher. Ce qui était enregistré l’est resté.</Text>
        {error.digest ? <Text size="sm" muted>Référence à transmettre si le problème persiste : {error.digest}</Text> : null}
        <Cluster gap={2}>
          <Button variant="primary" icon="repeat" onClick={() => reset()}>Réessayer</Button>
          <LinkButton href="/choose-workspace">Revenir à mes espaces</LinkButton>
        </Cluster>
      </Stack>
    </PublicShell>
  );
}
