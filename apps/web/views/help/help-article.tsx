import Link from 'next/link';
import { HELP_ARTICLES, helpHref, type HelpArticle } from '@/help/articles';
import { Banner, Cluster, Heading, LinkButton, Stack, Text } from '@/design';
import s from './help.module.css';

/** D-194 · Un article : ce qu’il permet, les étapes, « Bon à savoir », et les pages où aller. */
export function HelpArticleView({ article: a, base }: { article: HelpArticle; base: string }) {
  const more = HELP_ARTICLES.filter((x) => x.audience === a.audience && x.theme === a.theme && x.slug !== a.slug);
  return (
    <Stack gap={5} as="article" aria-labelledby="aide-titre">
      <Stack gap={2}>
        <p className={s.kicker}>{`Aide · ${a.theme}`}</p>
        <Heading level={1} size={2} id="aide-titre">{a.title}</Heading>
        <Text muted>{a.summary}</Text>
      </Stack>
      {a.steps?.length ? (
        <ol className={s.steps}>
          {a.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
      ) : null}
      {a.tips?.length ? (
        <Banner tone="info" title="Bon à savoir">
          <ul className={s.tips}>{a.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </Banner>
      ) : null}
      {a.links?.length ? (
        <Cluster gap={2}>
          {a.links.map((l, i) => <LinkButton key={l.to} href={helpHref(base, l.to)} variant={i ? 'secondary' : 'primary'} iconRight="arrowRight">{`Y aller : ${l.label}`}</LinkButton>)}
        </Cluster>
      ) : null}
      {more.length ? (
        <Stack gap={2} as="nav" aria-label="Dans le même thème">
          <Text size="sm" strong>{`Aussi dans « ${a.theme} »`}</Text>
          <ul className={s.more}>{more.map((x) => <li key={x.slug}><Link href={`${base}/aide/${x.slug}`}>{x.title}</Link></li>)}</ul>
        </Stack>
      ) : null}
      <div><LinkButton href={`${base}/aide`} variant="ghost" icon="chevronLeft">Toute l’aide</LinkButton></div>
    </Stack>
  );
}
