import type { ReactNode } from 'react';
import { Card, Heading, PublicShell, Stack, Text } from '@/design';
import type { NoticeSection } from '@/server/privacy/notice';
import s from '@/views/account/account.module.css';

/** D-174 · Texte légal public (conditions, mentions) : titre, version, sommaire, sections ; même lecture que la confidentialité. */
export function LegalPage({ title, intro, sections, children }: { title: string; intro: string; sections: NoticeSection[]; children?: ReactNode }) {
  return (
    <PublicShell wide>
      <Stack gap={6}>
        <Stack gap={1}>
          <Heading level={1} size={1}>{title}</Heading>
          <Text muted>{intro}</Text>
        </Stack>
        {sections.length > 2 ? (
          <Card as="nav" pad={5} aria-label="Sommaire">
            <ul className={s.toc}>{sections.map((x) => <li key={x.id}><a href={`#${x.id}`}>{x.title}</a></li>)}</ul>
          </Card>
        ) : null}
        {sections.map((x) => (
          <Stack as="section" key={x.id} id={x.id} gap={3} aria-labelledby={`t-${x.id}`}>
            <Heading level={2} size={3} id={`t-${x.id}`}>{x.title}</Heading>
            {x.paragraphs.map((p, i) => <p key={i} className={s.prose}>{p}</p>)}
            {x.items ? <ul className={s.items}>{x.items.map((it, i) => <li key={i}>{it}</li>)}</ul> : null}
          </Stack>
        ))}
        {children}
      </Stack>
    </PublicShell>
  );
}
