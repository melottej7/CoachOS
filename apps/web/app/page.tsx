import { redirect } from 'next/navigation';
import { requireActor } from '@/server/auth/session';

export default async function Home() {
  await requireActor();
  redirect('/choose-workspace');
}
