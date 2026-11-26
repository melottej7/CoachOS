/**
 * D-179 · Page de relecture de toutes les animations, rangées par type de machine, avec leur statut.
 * Usage : npx tsx scripts/machines-gallery.ts <fichier.html>
 */
import { writeFileSync } from 'node:fs';
import { machineLibrary, MACHINE_MOTIONS, motionStatus, MOTION_STATUS_LABELS, motionSvg } from '../packages/domain/src/index';

const out = process.argv[2];
if (!out) throw new Error('Fichier de sortie attendu');
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
let n = 0;
const groups = machineLibrary().map((g) => `<h2>${esc(g.label)}</h2>` + g.machines.map(({ machine, exercises }) => `<h3>${esc(machine.name)} <small>${esc(machine.en)}</small></h3><div class="grid">`
  + exercises.filter((e) => MACHINE_MOTIONS[e.key]).map((e) => {
    n++;
    return `<figure><div class="a">${motionSvg(MACHINE_MOTIONS[e.key]!, { title: e.name })}</div><figcaption><b>${n}. ${esc(e.name)}</b><span>${MOTION_STATUS_LABELS[motionStatus(e.key)!]} · ${esc(e.cues[1])}</span></figcaption></figure>`;
  }).join('') + '</div>').join('')).join('');
writeFileSync(out, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Animations des machines · relecture</title>
<style>:root{--ds-ink:#0E1116;--ds-ink-2:#5A6372;--ds-rule-strong:#C3C9D2;--ds-surface-3:#E3E6EB;--ds-signal:#FF5A1F}
body{font-family:system-ui,sans-serif;margin:16px;background:#F4F5F7;color:#0E1116}h1{font-size:20px}h2{font-size:18px;margin:28px 0 4px}h3{font-size:15px;margin:16px 0 6px}small{color:#5A6372;font-weight:400}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}figure{margin:0;background:#fff;border-radius:12px;padding:8px}
.a svg{width:100%;height:auto;display:block}figcaption{font-size:13px;line-height:1.35}figcaption span{display:block;color:#5A6372}</style>
<h1>Animations des machines · ${n} exercices à relire</h1><p>Dis-moi les numéros qui clochent (et pourquoi), ou « tout validé ».</p>${groups}</html>`);
console.log(`${n} animations`);
