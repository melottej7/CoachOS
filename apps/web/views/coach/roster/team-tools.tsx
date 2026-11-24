'use client';

import { useState, type FormEvent } from 'react';
import { fieldError } from '@/components/use-intent';
import { Button, Cluster, Input, MenuItem, Popover, Stack, Text } from '@/design';
import { useAction } from '@/views/coach/use-action';

/** Créer un groupe (lot G) : un nom, et c’est tout. */
export function CreateTeamForm({ wid }: { wid: string }) {
  const { act, pending, error } = useAction();
  const [name, setName] = useState('');
  return (
    <form onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await act('POST', `/api/v1/workspaces/${wid}/teams`, { name })) setName(''); }}>
      <Cluster gap={2} nowrap>
        <label className="ds-visually-hidden" htmlFor="team-name">Nom du nouveau groupe</label>
        <Input id="team-name" placeholder="Nouveau groupe, ex. Préparation marathon" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} invalid={!!fieldError(error, 'name')} />
        <Button type="submit" variant="primary" icon="plus" loading={pending} disabled={!name.trim()}>Créer</Button>
      </Cluster>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? fieldError(error, 'name') ?? error.message : 'Connexion perdue. Réessaie.'}</Text> : null}
    </form>
  );
}

/** Outils d’un groupe : renommer, remonter, archiver (les élèves et leurs séances ne changent pas). */
export function TeamTools({ wid, id, name, prevSortOrder }: { wid: string; id: string; name: string; prevSortOrder: number | null }) {
  const { act, pending, error } = useAction();
  const [value, setValue] = useState(name);
  const [renaming, setRenaming] = useState(false);
  const url = `/api/v1/workspaces/${wid}/teams/${id}`;
  if (renaming) {
    return (
      <form onSubmit={async (e: FormEvent) => { e.preventDefault(); if (await act('PATCH', url, { name: value })) setRenaming(false); }}>
        <Stack gap={2}>
          <label className="ds-visually-hidden" htmlFor={`rename-${id}`}>Nouveau nom du groupe {name}</label>
          <Input id={`rename-${id}`} maxLength={60} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          <Cluster gap={2}>
            <Button type="submit" size="sm" variant="primary" loading={pending}>Enregistrer</Button>
            <Button size="sm" variant="ghost" onClick={() => { setRenaming(false); setValue(name); }}>Annuler</Button>
          </Cluster>
          {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? fieldError(error, 'name') ?? error.message : 'Connexion perdue.'}</Text> : null}
        </Stack>
      </form>
    );
  }
  return (
    <>
      <Popover iconOnly icon="more" label={`Gérer le groupe ${name}`}>
        {(close) => (
          <>
            <MenuItem icon="edit" onClick={() => { close(); setRenaming(true); }}>Renommer</MenuItem>
            {prevSortOrder !== null ? <MenuItem onClick={() => { close(); void act('PATCH', url, { sortOrder: prevSortOrder }); }}>Placer plus haut</MenuItem> : null}
            <MenuItem tone="danger" onClick={() => { close(); if (window.confirm(`Archiver le groupe « ${name} » ? Les élèves et leurs séances ne changent pas.`)) void act('PATCH', url, { archived: true }); }}>Archiver</MenuItem>
          </>
        )}
      </Popover>
      {error ? <Text size="sm" tone="danger" role="alert">{error.kind === 'error' ? error.message : 'Connexion perdue.'}</Text> : null}
    </>
  );
}
