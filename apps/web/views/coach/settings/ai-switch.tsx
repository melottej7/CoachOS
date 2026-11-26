'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useIntent } from '@/components/use-intent';
import { Checkbox, Stack, Text } from '@/design';

/**
 * IA-0 · Interrupteur de l’IA pour tout l’espace (propriétaire). Enregistré à chaque changement ; éteinte, l’IA
 * (Claude ou simulée) ne propose plus rien et tout reste faisable à la main.
 */
export function AiSwitch({ wid, initial }: { wid: string; initial: boolean }) {
  const router = useRouter();
  const { run, pending, error } = useIntent<{ enabled: boolean }>();
  const [on, setOn] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function change(v: boolean) {
    setSaved(false);
    setOn(v);
    const r = await run('PUT', `/api/v1/workspaces/${wid}/ai-settings`, { enabled: v });
    if (r) { setSaved(true); router.refresh(); } else setOn(!v);
  }

  return (
    <Stack gap={2}>
      <Checkbox id="ai-on" checked={on} onChange={(v) => { if (!pending) void change(v); }}
        label="IA activée pour cet espace"
        hint="Éteinte, « Ajuster avec l’IA » disparaît pour tous les coachs de l’espace ; tout reste faisable à la main." />
      {saved ? <Text as="span" size="sm" tone="success" role="status">{on ? 'IA allumée' : 'IA éteinte'} · enregistré</Text> : null}
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Pas de connexion : réessaie.'}</Text> : null}
    </Stack>
  );
}
