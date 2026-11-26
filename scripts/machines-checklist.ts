/**
 * D-179 · Liste à cocher des machines, à vérifier dans un club, tirée de la bibliothèque (une seule source).
 * Usage : npx tsx scripts/machines-checklist.ts > docs/execution/MACHINES_A_COCHER.md
 */
import { AVAILABILITY_LABELS, GYM_CHAINS, MACHINE_LEVEL_LABELS, machineLibrary, alternativeName } from '../packages/domain/src/index';

const chain = 'basic-fit-be' as const;
const out: string[] = [
  `# Machines à cocher dans ton club (${GYM_CHAINS[chain]})`,
  '',
  'Coche ce que tu vois. Pour une machine que tu ne reconnais pas, prends-la en photo (de côté, la plaque de la marque visible) : je l’identifie.',
  '« Sûr » = cité par Basic-Fit sur ses pages ; « Très probable » = de série chez la marque équipementière, à confirmer ; « Selon le club » = à vérifier.',
  '',
];
for (const g of machineLibrary()) {
  out.push(`## ${g.label}`, '');
  for (const { machine, exercises } of g.machines) {
    out.push(`- [ ] **${machine.name}** (« ${machine.en} » sur la machine ?) · n° dans ton club : ____ · ${AVAILABILITY_LABELS[machine.chains[chain] ?? 'verify']} · ${machine.looks}`);
    out.push(`  ${exercises.map((e) => e.name).join(' · ')}`);
  }
  out.push('');
}
out.push('## Détail des exercices', '');
for (const g of machineLibrary()) for (const { machine, exercises } of g.machines) {
  out.push(`### ${machine.name}`, '');
  for (const e of exercises) {
    out.push(`**${e.name}** · ${e.muscles} · ${MACHINE_LEVEL_LABELS[e.level]}  `);
    out.push(`Réglages : ${e.settings}  `);
    out.push(`Consignes : ${e.cues.join(' / ')}  `);
    out.push(`Erreur fréquente : ${e.mistake}  `);
    out.push(`Si la machine est prise : ${alternativeName(e.alternative)}`, '');
  }
}
process.stdout.write(out.join('\n'));
