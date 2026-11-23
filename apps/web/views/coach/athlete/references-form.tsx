'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPace, parseSwimPace, ZONE_GUIDE, ZONE_NAMES, zonePace, zonePower, zoneSwimPace, ZONES } from '@coachos/domain';
import { useIntent } from '@/components/use-intent';
import { Button, Cluster, DataTable, Field, Input, Stack, Text } from '@/design';
import s from './fiche.module.css';

const mmss = (x: number) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;

/**
 * Repères d’entraînement fixés par le coach (CE-B-03, D-029, D-055), refonte Chrono (D-151) : VMA (course), FTP (vélo),
 * CSS (natation). Chacun traduit les 7 zones pour cet élève ; il sert aussi aux estimations et au fichier FIT.
 */
export function ReferencesForm({ wid, aid, first, vmaKmh, ftpW, cssSecPer100 }: {
  wid: string; aid: string; first: string; vmaKmh: number | null; ftpW?: number | null; cssSecPer100?: number | null;
}) {
  const router = useRouter();
  const { run, pending, error } = useIntent<unknown>();
  const [vmaText, setVma] = useState(vmaKmh === null ? '' : String(vmaKmh).replace('.', ','));
  const [ftpText, setFtp] = useState(ftpW ? String(ftpW) : '');
  const [cssText, setCss] = useState(cssSecPer100 ? mmss(cssSecPer100) : '');
  const [saved, setSaved] = useState(false);

  const vma = vmaText.trim() === '' ? null : Number(vmaText.replace(',', '.'));
  const ftp = ftpText.trim() === '' ? null : Number(ftpText);
  const css = cssText.trim() === '' ? null : parseSwimPace(cssText);
  const errs = {
    vma: vma !== null && !(Number.isFinite(vma) && vma >= 6 && vma <= 30) ? 'Un nombre entre 6 et 30 km/h' : null,
    ftp: ftp !== null && !(Number.isInteger(ftp) && ftp >= 50 && ftp <= 600) ? 'Un nombre entier entre 50 et 600 W' : null,
    css: cssText.trim() !== '' && (css === null || css < 50 || css > 300) ? 'Une allure pour 100 m, par exemple 1:45' : null,
  };
  const valid = !errs.vma && !errs.ftp && !errs.css;
  const serverError = error?.kind === 'error' ? error.fields[0]?.rule ?? error.message : error ? 'Connexion perdue. Réessaie.' : null;
  const touch = () => setSaved(false);
  const showVma = vma !== null && !errs.vma, showFtp = ftp !== null && !errs.ftp, showCss = css !== null && !errs.css;
  const head = ['Zone', 'Usage', 'Sensation', ...(showVma ? ['Course'] : []), ...(showFtp ? ['Vélo'] : []), ...(showCss ? ['Natation'] : [])];

  return (
    <form noValidate onSubmit={async (e) => {
      e.preventDefault();
      if (!valid) return;
      setSaved(false);
      const r = await run('PUT', `/api/v1/workspaces/${wid}/athletes/${aid}/references`, { vmaKmh: vma, ftpW: ftp, cssSecPer100: css });
      if (r) { setSaved(true); router.refresh(); }
    }}>
      <Stack gap={4}>
        <Text size="sm" muted>Les repères de {first} traduisent les zones en allures ou en watts, dans ses séances et dans le fichier pour sa montre. Remplis ceux de ses sports.</Text>
        <div className={s.refs}>
          <Field id="vma" label="VMA · course" hint="En km/h" error={errs.vma}>
            <span className={s.unit}><Input id="vma" inputMode="decimal" placeholder="15,5" value={vmaText} invalid={!!errs.vma} hasHint onChange={(e) => { setVma(e.target.value); touch(); }} /> km/h</span>
          </Field>
          <Field id="ftp" label="FTP · vélo" hint="Watts tenus sur 1 h" error={errs.ftp}>
            <span className={s.unit}><Input id="ftp" inputMode="numeric" placeholder="230" value={ftpText} invalid={!!errs.ftp} hasHint onChange={(e) => { setFtp(e.target.value); touch(); }} /> W</span>
          </Field>
          <Field id="css" label="CSS · natation" hint="Allure seuil" error={errs.css}>
            <span className={s.unit}><Input id="css" inputMode="text" placeholder="1:45" value={cssText} invalid={!!errs.css} hasHint onChange={(e) => { setCss(e.target.value); touch(); }} /> /100 m</span>
          </Field>
        </div>
        <Cluster gap={2}>
          <Button type="submit" size="sm" variant="primary" loading={pending} disabled={!valid}>Enregistrer les repères</Button>
          {saved ? <Text as="span" size="sm" tone="success" role="status">Enregistré.</Text> : null}
        </Cluster>
        {serverError ? <Text size="sm" tone="danger" role="alert">{serverError}</Text> : null}
        {showVma || showFtp || showCss ? (
          <DataTable caption={`Cibles par zone pour ${first}`} head={head} rows={ZONES.map((z) => {
            const p = showVma ? zonePace(z, vma!) : null;
            const w = showFtp ? zonePower(z, ftp!) : null;
            const c = showCss ? zoneSwimPace(z, css!) : null;
            return {
              key: String(z),
              cells: [
                <span key="z"><span className={`${s.zoneDot} ${s[`z${z}`]}`} aria-hidden="true" />Z{z}</span>,
                `${ZONE_NAMES[z]} · ${ZONE_GUIDE[z].use}`,
                ZONE_GUIDE[z].feel,
                ...(p ? [`${formatPace(p[0]).replace(' /km', '')} à ${formatPace(p[1])}`] : []),
                ...(w ? [`${w[0]} à ${w[1]} W`] : []),
                ...(c ? [`${mmss(c[0])} à ${mmss(c[1])} /100 m`] : []),
              ],
            };
          })} />
        ) : <Text size="sm" muted>Sans repère, les séances indiquent les zones et la durée, sans allure, watts ni kilomètres estimés.</Text>}
      </Stack>
    </form>
  );
}
