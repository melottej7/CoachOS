import { redirect } from 'next/navigation';

/** Ancienne présentation en diapositives (D-021), remplacée par la visite sur les vrais écrans (D-028). */
export default async function Welcome({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  redirect(`/coach/${wid}/planning?tour=start`);
}
