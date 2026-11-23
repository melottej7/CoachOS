import Link from 'next/link';
import { cx } from './cx';
import { ZoneChip, type ZoneLevel } from './zones';
import { Badge } from './core';
import s from './calendar.module.css';
import z from './zones.module.css';

/** Onglets segmentés par liens (Semaine / Mois). */
export function SegmentedLinks({ label, items }: { label: string; items: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className={s.segmented}>
      {items.map((i) => <Link key={i.href} href={i.href} className={s.segment} aria-current={i.current ? 'page' : undefined}>{i.label}</Link>)}
    </nav>
  );
}

/** `tag` remplace « Zn » quand la séance n’a pas d’intensité (renforcement : « Force »). */
export interface CalendarItem { id: string; href: string; title: string; zone: number; tag?: string; meta?: string; done?: boolean; canceled?: boolean }
export interface CalendarDay { date: string; name: string; num: string; today?: boolean; out?: boolean; href?: string; items: CalendarItem[] }

const zoneLevel = (n: number) => Math.max(0, Math.min(7, n)) as ZoneLevel;

/** Semaine jour par jour, jours de repos compris : le rythme se lit d’un coup d’œil. */
export function WeekDays({ days, label }: { days: CalendarDay[]; label: string }) {
  return (
    <ol className={s.days} aria-label={label}>
      {days.map((d) => (
        <li key={d.date} className={cx(s.day, d.today && s.dayToday)} aria-current={d.today ? 'date' : undefined}>
          <span className={s.date}><span className={s.dateName}>{d.name}</span><span className={s.dateNum}>{d.num}</span></span>
          {d.items.length ? (
            <span className={s.items}>
              {d.items.map((i) => (
                <Link key={i.id} href={i.href} className={cx(s.item, i.canceled && s.canceled)}>
                  <span className={s.lead}>{i.zone || !i.tag ? <ZoneChip zone={zoneLevel(i.zone)} /> : <span className={s.tag}>{i.tag}</span>}</span>
                  <span className={s.itemText}><span className={s.itemTitle}>{i.title}</span>{i.meta ? <span className={s.itemMeta}>{i.meta}</span> : null}</span>
                  {i.canceled ? <Badge tone="warning">Annulée</Badge> : i.done ? <Badge tone="success" dot>Faite</Badge> : null}
                </Link>
              ))}
            </span>
          ) : <span className={s.rest}>Repos</span>}
        </li>
      ))}
    </ol>
  );
}

/** Mois en grille : une pastille par séance (couleur de sa zone), un total par semaine. */
export function MonthGrid({ weeks, label, dayNames }: { weeks: { days: CalendarDay[]; total: { main: string; sub: string } }[]; label: string; dayNames: string[] }) {
  return (
    <section className={s.month} aria-label={label}>
      <div className={s.monthHead} aria-hidden="true">{dayNames.map((n) => <span key={n}>{n}</span>)}<span>Total</span></div>
      {weeks.map((w, k) => (
        <div key={k} className={s.monthWeek}>
          {w.days.map((d) => {
            const desc = `${d.name} ${d.num}${d.items.length ? ` : ${d.items.map((i) => `${i.title}${i.done ? ' (faite)' : i.canceled ? ' (annulée)' : ''}`).join(', ')}` : ', repos'}`;
            return (
              <Link key={d.date} href={d.href ?? '#'} aria-label={desc} className={cx(s.cell, d.out && s.cellOut, d.today && s.cellToday)} aria-current={d.today ? 'date' : undefined}>
                <span className={s.cellNum}>{d.num}</span>
                <span className={s.dots} aria-hidden="true">
                  {d.items.map((i) => <span key={i.id} className={cx(s.dot, i.zone ? z[`z${zoneLevel(i.zone)}`] : s.dotFree, i.done && s.dotDone, i.canceled && s.dotCanceled)} />)}
                </span>
                <span className={s.cellTitles} aria-hidden="true">{d.items.map((i) => <span key={i.id}>{i.title}</span>)}</span>
              </Link>
            );
          })}
          <div className={s.total}>{w.total.main ? <span className={s.totalMain}>{w.total.main}</span> : null}<span className={s.totalSub}>{w.total.sub}</span></div>
        </div>
      ))}
    </section>
  );
}
