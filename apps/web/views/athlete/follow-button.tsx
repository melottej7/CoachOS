'use client';

import { useEffect, useState } from 'react';
import { LinkButton } from '@/design';
import { followInProgress } from './follow-store';

/** D-167 · « Suivre la séance », ou « Reprendre la séance » quand elle a été commencée sur ce téléphone et pas finie. */
export function FollowButton({ href, sid }: { href: string; sid: string }) {
  const [resume, setResume] = useState(false);
  useEffect(() => { setResume(followInProgress(sid)); }, [sid]);
  return <LinkButton href={href} variant="coach" size="lg" icon="play">{resume ? 'Reprendre la séance' : 'Suivre la séance'}</LinkButton>;
}
