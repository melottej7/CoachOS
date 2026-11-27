import { notFound } from 'next/navigation';
import { helpArticle } from '@/help/articles';
import { HelpArticleView } from '@/views/help/help-article';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const a = helpArticle('athlete', (await params).slug);
  return { title: a ? `Aide · ${a.title}` : 'Aide' };
}

/** D-194 · Un article d’aide de l’élève. */
export default async function AthleteHelpArticle({ params }: { params: Promise<{ wid: string; slug: string }> }) {
  const { wid, slug } = await params;
  const a = helpArticle('athlete', slug);
  if (!a) notFound();
  return <HelpArticleView article={a} base={`/athlete/${wid}`} />;
}
