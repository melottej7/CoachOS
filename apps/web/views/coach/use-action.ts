'use client';

import { useRouter } from 'next/navigation';
import { useIntent } from '@/components/use-intent';

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Une action = une intention idempotente, puis la page se relit (D-032). */
export function useAction() {
  const router = useRouter();
  const intent = useIntent<unknown>();
  const act = async (method: Method, url: string, body: unknown = {}) => {
    const r = await intent.run(method, url, body);
    if (r !== null) router.refresh();
    return r !== null;
  };
  return { ...intent, act };
}
