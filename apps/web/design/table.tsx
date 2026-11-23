import type { ReactNode } from 'react';
import s from './table.module.css';

/** Tableau de données : en-têtes de colonnes et de lignes, chiffres alignés, défilement horizontal sur téléphone. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: { key: string; cells: ReactNode[] }[] }) {
  return (
    <div className={s.frame} tabIndex={0} role="region" aria-label={caption}>
      <table className={s.table}>
        <caption className="ds-visually-hidden">{caption}</caption>
        <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>{r.cells.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
