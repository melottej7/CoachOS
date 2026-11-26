/**
 * D-179 · Comparaison des façons de montrer un exercice sur machine, sur les trois pilotes, côte à côte.
 * Usage : npx tsx scripts/machines-preview.ts docs/execution/videos-machines.html
 */
import { writeFileSync } from 'node:fs';
import { alternativeName, MACHINE_MOTIONS, machineExercise, motionSvg, motionStatus, MOTION_STATUS_LABELS } from '../packages/domain/src/index';

const out = process.argv[2];
if (!out) throw new Error('Fichier de sortie attendu');
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Plan à tourner par pilote : angle, cadrage, durée. */
const SHOTS: Record<string, string> = {
  'presse-a-cuisses': 'De profil, côté plateforme libre ; téléphone à hauteur de hanche, à 2,5 m ; tout le corps et la plateforme dans le cadre ; 3 répétitions (15 s).',
  'tirage-vertical': 'De profil, à 3 m ; téléphone à hauteur d’épaule assise ; de la poulie haute aux pieds dans le cadre ; 3 répétitions (15 s). Second plan de dos pour les omoplates (facultatif).',
  'developpe-machine': 'De profil, à 2,5 m ; téléphone à hauteur de poitrine assise ; dossier, poignées et pieds dans le cadre ; 3 répétitions (15 s).',
};

const rows = Object.values(MACHINE_MOTIONS).map((m) => {
  const e = machineExercise(m.key)!;
  const svg = motionSvg(m, { title: `${e.name} : animation` });
  return `<tr>
<th scope="row"><b>${esc(e.name)}</b><span>${esc(e.muscles)}</span><span>Si prise : ${esc(alternativeName(e.alternative) ?? '')}</span></th>
<td data-h="1. Animation dessinée"><div class="anim">${svg}</div><p class="ok">Faite · ${(svg.length / 1024).toFixed(1)} Ko · ${MOTION_STATUS_LABELS[motionStatus(m.key)!]}</p></td>
<td data-h="2. Vidéo du fondateur"><div class="phone"><div class="anim dim">${motionSvg(m, { still: true })}</div><ol>${e.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ol></div>
<p class="todo">Maquette : ta vidéo à la place du dessin. ${esc(SHOTS[m.key] ?? '')}</p></td>
<td data-h="3. Bibliothèque achetée"><div class="empty">Pas d’aperçu : aucune image n’est reprise sans licence.</div><p class="todo">WorkoutLabs (dessins 2D, MP4 en option) ou packs 3D (Fab, Envato) : machines génériques, style différent de l’app.</p></td>
<td data-h="4. Vidéo générée par IA"><div class="empty">Non produite : le geste ne peut pas être prouvé juste ici.</div><p class="todo">Protocole d’essai prêt (5 critères mesurés image par image), voir le document.</p></td>
</tr>`;
}).join('');

writeFileSync(out, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vidéos des machines · comparaison</title>
<style>:root{--ds-ink:#0E1116;--ds-ink-2:#5A6372;--ds-rule-strong:#C3C9D2;--ds-surface-3:#E3E6EB;--ds-signal:#FF5A1F;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--ds-ink:#E8EBF0;--ds-ink-2:#9AA3B2;--ds-rule-strong:#3A414D;--ds-surface-3:#262C36}body{background:#0E1116!important;color:#E8EBF0}td,th{background:#161A21!important}}
body{font-family:'Barlow',system-ui,sans-serif;margin:24px;background:#F4F5F7;color:#0E1116}h1{font-size:22px;margin:0 0 4px}p.lead{margin:0 0 16px;color:#5A6372;font-size:14px}
table{border-collapse:separate;border-spacing:8px;width:100%;table-layout:fixed}th,td{background:#fff;border-radius:14px;padding:12px;vertical-align:top;font-size:13px;line-height:1.35}
thead th{font-size:14px;text-align:left}tbody th{width:150px;text-align:left}tbody th b{display:block;font-size:15px;margin-bottom:4px}tbody th span{display:block;color:#5A6372;margin-top:4px}
.anim svg{width:100%;height:auto;display:block}.dim{opacity:.55}.ok{color:#0A6452;font-weight:600;margin:6px 0 0}.todo{color:#5A6372;margin:6px 0 0}
.phone{border:2px solid #C3C9D2;border-radius:16px;padding:8px}.phone ol{margin:6px 0 0;padding-left:18px}.empty{border:2px dashed #C3C9D2;border-radius:12px;padding:28px 12px;text-align:center;color:#5A6372}
@media (max-width:700px){table,thead,tbody,tr,th,td{display:block;width:auto!important}thead{display:none}td::before{content:attr(data-h);font-weight:700;display:block;margin-bottom:6px}}</style>
<h1>Montrer un exercice sur machine : quatre façons, trois pilotes</h1>
<p class="lead">Boucle muette de 4 s, aux couleurs de CoachOS. Colonne 1 : réalisée et vérifiée. Colonnes 2 à 4 : ce qu’il faudrait pour les obtenir.</p>
<table><thead><tr><th></th><th>1. Animation dessinée (recommandée)</th><th>2. Vidéo du fondateur</th><th>3. Bibliothèque achetée</th><th>4. Vidéo générée par IA</th></tr></thead>
<tbody>${rows}</tbody></table></html>`);
