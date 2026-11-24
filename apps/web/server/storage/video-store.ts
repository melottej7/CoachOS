import { supabaseAdmin } from '../supabase/admin';

/**
 * D-173 · Vidéos filmées par les coachs dans le stockage de fichiers Supabase (compartiment privé).
 * Aucune règle d’accès client : le serveur signe chaque envoi et chaque lecture, après contrôle des droits.
 * Sans Supabase (démonstration PGlite, tests), pas de stockage : les vidéos restent en base, comme avant.
 */
export const VIDEO_BUCKET = 'exercise-videos';
/** Adresse d’une vidéo dans le compartiment : « espace/vidéo » (la base le vérifie aussi). */
export const clipObjectPath = (workspaceId: string, clipId: string) => `${workspaceId}/${clipId}`;
/** Durée d’un lien de lecture : une séance entière, vidéo revue comprise. */
export const READ_URL_SECONDS = 2 * 60 * 60;

export interface VideoStore {
  /** Lien d’envoi direct pour ce seul chemin, sans écrasement (valable deux heures, règle Supabase). */
  uploadUrl(path: string): Promise<string>;
  /** Premiers octets (pour reconnaître le format) et taille totale ; null si rien n’a été envoyé. */
  head(path: string): Promise<{ size: number; head: Uint8Array } | null>;
  /** Lien de lecture signé, de courte durée. */
  readUrl(path: string, seconds: number): Promise<string>;
  remove(paths: string[]): Promise<void>;
}

let override: VideoStore | null | undefined;
/** Tests : remplace le stockage (un faux en mémoire, ou null pour « pas de stockage »). */
export function setVideoStore(store: VideoStore | null | undefined) { override = store; }

export function videoStore(): VideoStore | null {
  if (override !== undefined) return override;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const bucket = () => supabaseAdmin().storage.from(VIDEO_BUCKET);
  return {
    async uploadUrl(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error('storage_upload_url');
      return data.signedUrl;
    },
    async head(path) {
      const { data, error } = await bucket().createSignedUrl(path, 60);
      if (error || !data) return null;
      const res = await fetch(data.signedUrl, { headers: { range: 'bytes=0-4095' }, cache: 'no-store' });
      if (res.status === 400 || res.status === 404) return null;
      if (!res.ok) throw new Error(`storage_head_${res.status}`);
      const head = new Uint8Array(await res.arrayBuffer()).slice(0, 4096);
      const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length') ?? head.length);
      return { size: Number.isFinite(total) ? total : head.length, head };
    },
    async readUrl(path, seconds) {
      const { data, error } = await bucket().createSignedUrl(path, seconds);
      if (error || !data) throw error ?? new Error('storage_read_url');
      return data.signedUrl;
    },
    async remove(paths) {
      if (!paths.length) return;
      const { error } = await bucket().remove(paths);
      if (error) throw error;
    },
  };
}
