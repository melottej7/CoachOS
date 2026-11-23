'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { LOCALES, LOCALE_LABELS, type Locale } from '@coachos/domain';
import { fieldError, useIntent } from '@/components/use-intent';
import { Button, Cluster, Field, Input, Select, Stack } from '@/design';
import { ErrorSummary } from '@/views/error-summary';

/** C02-07, refonte Chrono (D-155) : nom du compte et langue. Aucune donnée de santé. */
export function AccountForm({ initialName, initialLocale, after }: { initialName: string; initialLocale: Locale; after: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const { run, pending, error } = useIntent<{ displayName: string }>();
  const changed = name.trim() !== initialName || locale !== initialLocale;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!changed) return;
    if (await run('PATCH', '/api/v1/me', { displayName: name, locale })) { router.push(after); router.refresh(); }
  }

  const nameError = fieldError(error, 'displayName');
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap={4}>
        <ErrorSummary error={error} onRetry={() => void submit()} labels={{ displayName: 'Ton nom' }} />
        <Field id="displayName" label="Ton nom" hint="Prénom et nom, affichés en haut de l’écran et chez tes élèves ou ton coach" error={nameError}>
          <Input id="displayName" required maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} invalid={!!nameError} hasHint />
        </Field>
        <Field id="locale" label="Langue">
          <Select id="locale" value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
          </Select>
        </Field>
        <Cluster><Button type="submit" variant="primary" icon="check" loading={pending} disabled={!changed}>Enregistrer</Button></Cluster>
      </Stack>
    </form>
  );
}
