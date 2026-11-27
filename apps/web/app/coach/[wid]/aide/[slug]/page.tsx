import { notFound } from 'next/navigation';
import { helpArticle } from '@/help/articles';
import { HelpArticleView } from '@/views/help/help-article';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpArticle('coach', (await params).slug);
  return { title: a ? `Aide · ${a.title}` : 'Aide' };
}

/** D-194 · Un article d’aide du coach. */
export default async function CoachHelpArticle({ params }: { params: Promise<{ wid: string; slug: string }> }) {
  const { wid, slug } = await params;
  const a = helpArticle('coach', slug);
  if (!a) notFound();
  return <HelpArticleView article={a} base={`/coach/${wid}`} />;
}
