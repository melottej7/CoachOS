import { redirect } from 'next/navigation';

export default async function CoachHome({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  redirect(`/coach/${wid}/planning`);
}
