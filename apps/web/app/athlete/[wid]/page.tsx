import { redirect } from 'next/navigation';

export default async function AthleteHome({ params }: { params: Promise<{ wid: string }> }) {
  const { wid } = await params;
  redirect(`/athlete/${wid}/today`);
}
