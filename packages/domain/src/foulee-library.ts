import type { LibraryCategory, LibraryWorkout } from './library';
import { parseNotation } from './notation';
import type { Block } from './structure';

/**
 * Bibliothèque Foulée (D-068), importée à la demande du fondateur (« Tu peux importer la bibliothèque de séances de
 * Foulée », 19 novembre 2026). Source : FOULEE_DOSSIER_TRANSMISSION.md, annexe F (79 familles, 324 séances) et
 * annexe H (7 zones, notation « 15' Z1 + 8×(200m Z7 + R200m) + 10' Z1 »).
 * L’annexe donne, pour chaque famille, le premier et le dernier palier et leur nombre. Les paliers intermédiaires sont
 * calculés par progression régulière (comme Foulée les avait interpolés depuis les programmes du coach). Le fondateur
 * a validé ces paliers calculés (D-077) ; ils sont marqués dans meta.calculated, jamais dans les consignes de l’élève.
 */

export type FouleeLevel = 'D' | 'I' | 'C';
export type FouleePhase = 'reprise' | 'base' | 'developpement' | 'specifique' | 'affutage';

export const FOULEE_LEVEL_WORDS: Record<FouleeLevel, string> = { D: 'débutant', I: 'intermédiaire', C: 'confirmé' };
export const FOULEE_PHASE_WORDS: Record<FouleePhase, string> = { reprise: 'reprise', base: 'base', developpement: 'développement', specifique: 'spécifique', affutage: 'affûtage' };

interface Family {
  id: string;
  category: LibraryCategory;
  levels: FouleeLevel[];
  phases: FouleePhase[];
  tiers: number;
  /** Titre et notation du palier k (0 = premier, tiers − 1 = dernier). */
  at: (k: number, n: number) => [title: string, notation: string];
}

/** Valeur au palier k entre a (premier) et b (dernier), arrondie au pas. */
const lerp = (a: number, b: number, k: number, n: number, step = 1) => (n <= 1 ? a : Math.round((a + ((b - a) * k) / (n - 1)) / step) * step);
const dur = (m: number) => (m < 60 ? `${m}'` : `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`);
const rec = (s: number) => (s % 60 ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}` : `${s / 60}'`);
const WU = "15' Z2";
const CD = "10' Z1";
const q = (main: string) => `${WU} + ${main} + ${CD}`;
const series = (s: number, one: string, between = "3' Z1") => Array.from({ length: s }, () => one).join(` + ${between} + `);
const ALL: FouleeLevel[] = ['D', 'I', 'C'];
const IC: FouleeLevel[] = ['I', 'C'];
const EVERY: FouleePhase[] = ['reprise', 'base', 'developpement', 'specifique', 'affutage'];

const F: Family[] = [
  // ——— Footings (footing_ef) ———
  { id: 'footing', category: 'endurance', levels: ALL, phases: EVERY, tiers: 10, at: (k, n) => { const m = lerp(20, 70, k, n, 5); return [`Footing ${dur(m)}`, `${m}' Z2`]; } },
  { id: 'footing-recup', category: 'recovery', levels: ALL, phases: EVERY, tiers: 4, at: (k, n) => { const m = lerp(20, 40, k, n, 5); return [`Footing de récupération ${m}'`, `${m}' Z1`]; } },
  { id: 'footing-lignes-droites', category: 'endurance', levels: ALL, phases: ['reprise', 'base', 'developpement', 'affutage'], tiers: 5, at: (k, n) => { const m = lerp(25, 50, k, n, 5), r = lerp(4, 10, k, n); return [`Footing ${m}' + ${r} lignes droites`, `${m}' Z2 + ${r}×(20" Z6 + R40")`]; } },
  { id: 'footing-veille', category: 'endurance', levels: ALL, phases: ['affutage'], tiers: 3, at: (k, n) => { const m = lerp(15, 25, k, n, 5); return [`Veille de course ${m}' + 3 lignes droites`, `${m}' Z2 + 3×(20" Z6 + R40")`]; } },
  { id: 'footing-progressif', category: 'endurance', levels: ALL, phases: ['base', 'developpement'], tiers: 4, at: (k, n) => { const m = lerp(30, 50, k, n, 5), b = Math.round(m / 3 / 5) * 5; return [`Footing progressif ${m}'`, `${m - b}' Z2 + ${b}' Z3`]; } },
  { id: 'footing-fin-active', category: 'endurance', levels: IC, phases: ['developpement', 'specifique'], tiers: 4, at: (k, n) => { const m = lerp(40, 60, k, n, 5); return [`Footing ${dur(m)} avec fin active`, `${m - 10}' Z2 + 10' Z3`]; } },
  { id: 'footing-vallonne', category: 'endurance', levels: ALL, phases: ['base', 'developpement'], tiers: 4, at: (k, n) => { const m = lerp(30, 60, k, n, 5); return [`Footing vallonné ${dur(m)}`, `${m}' Z2 « parcours vallonné, sans forcer dans les montées »`]; } },
  { id: 'gammes', category: 'technique', levels: ALL, phases: ['base', 'developpement', 'specifique'], tiers: 4, at: (k, n) => { const m = lerp(20, 35, k, n, 5); return [`Footing ${m}' + gammes${k === n - 1 ? ' complètes' : ''}`, `${m}' Z2 + 10' Z1 « gammes : talons-fesses, montées de genoux, pas chassés »`]; } },
  // ——— Sorties longues ———
  { id: 'sortie-longue', category: 'long', levels: ALL, phases: ['base', 'developpement', 'specifique'], tiers: 10, at: (k, n) => { const m = lerp(50, 150, k, n, 5); return [`Sortie longue ${dur(m)}`, `${m}' Z2`]; } },
  { id: 'sortie-longue-blocs', category: 'long', levels: ['D'], phases: ['reprise', 'base'], tiers: 8, at: (k, n) => { const b = lerp(20, 45, k, n); return [`Sortie longue en blocs 2×${b}'`, `2×(${b}' Z2 + R3')`]; } },
  { id: 'sortie-longue-fin-allure', category: 'long', levels: IC, phases: ['specifique'], tiers: 6, at: (k, n) => { const t = lerp(75, 130, k, n, 5), a = lerp(15, 40, k, n, 5); return [`Sortie longue ${dur(t)} dont ${a}' à allure course`, `${t - a}' Z2 + ${a}' Z4 « allure course »`]; } },
  { id: 'sortie-longue-km-allure', category: 'long', levels: IC, phases: ['specifique'], tiers: 9, at: (k, n) => { const d = lerp(14, 30, k, n), a = lerp(4, 12, k, n); return [`Sortie longue ${d} km dont ${a} km à allure course`, `${d - a}km Z2 + ${a}km Z4 « allure course »`]; } },
  { id: 'sortie-longue-blocs-allure', category: 'long', levels: IC, phases: ['specifique'], tiers: 6, at: (k) => { const [r, l] = ([[3, 2], [4, 2], [5, 2], [3, 3], [4, 3], [5, 3]] as const)[k]!; return [`Endurance + ${r}×${l} km à allure course`, `30' Z2 + ${r}×(${l}km Z4 « allure course » + R1km) + 10' Z1`]; } },
  { id: 'sortie-longue-progressive', category: 'long', levels: IC, phases: ['developpement', 'specifique'], tiers: 4, at: (k, n) => { const m = lerp(70, 105, k, n, 5), b = Math.round(m / 3 / 5) * 5; return [`Sortie longue progressive ${dur(m)}`, `${m - b}' Z2 + ${b}' Z3`]; } },
  // ——— Course-marche (débutants) ———
  ...([[1, 6, 12, 6], [2, 6, 10, 4], [3, 5, 8, 4], [5, 4, 6, 4]] as const).map(([d, r0, r1, tiers]): Family => ({
    id: `course-marche-${d}`, category: 'endurance', levels: ['D'], phases: d === 5 ? ['reprise', 'base'] : ['reprise'], tiers,
    // Une seule chose change à la fois : d’abord les répétitions, puis la récupération (comme les paliers de Foulée).
    at: (k, n) => { const r = k === n - 1 ? r1 : lerp(r0, r1, k, n - 1), s = k === n - 1 ? 60 : 90; return [`Course-marche ${r}×${d}' (R${rec(s)})`, `${r}×(${d}' Z2 + R${rec(s)} « marche »)`]; },
  })),
  { id: 'course-marche-8', category: 'endurance', levels: ['D'], phases: ['reprise', 'base'], tiers: 4, at: (k, n) => { const r = lerp(3, 4, k, n), d = lerp(8, 10, k, n); return [`Course-marche ${r}×${d}'`, `${r}×(${d}' Z2 + R2' « marche »)`]; } },
  { id: 'course-blocs', category: 'endurance', levels: ['D'], phases: ['base'], tiers: 6, at: (k, n) => { const b = lerp(12, 25, k, n); return [`Blocs de course 2×${b}'`, `2×(${b}' Z2 + R2' « marche »)`]; } },
  { id: 'course-continue', category: 'endurance', levels: ['D'], phases: ['reprise', 'base'], tiers: 4, at: (k, n) => { const m = lerp(15, 30, k, n, 5); return [`Première sortie sans marcher ${m}'`, `${m}' Z2`]; } },
  { id: 'marche-active', category: 'recovery', levels: ['D'], phases: ['reprise'], tiers: 4, at: (k, n) => { const m = lerp(20, 50, k, n, 5); return [`Marche active ${m}'`, `${m}' Z1 « marche active »`]; } },
  // ——— VMA courte ———
  { id: 'intro-20-40', category: 'intervals', levels: ['D'], phases: ['reprise', 'base'], tiers: 4, at: (k, n) => { const r = lerp(6, 12, k, n); return [`Intro fractionné ${r}×20"/40"`, q(`${r}×(20" Z6 + R40")`)]; } },
  { id: '30-30', category: 'intervals', levels: ALL, phases: ['base', 'developpement'], tiers: 4, at: (k, n) => { const r = lerp(8, 15, k, n); return [`30"/30" · ${r} répétitions`, q(`${r}×(30" Z7 + R30")`)]; } },
  { id: '30-30-series', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 6, at: (k, n) => { const s = lerp(2, 3, k, n), r = lerp(6, 10, k, n); return [`30"/30" · ${s}×${r}`, q(series(s, `${r}×(30" Z7 + R30")`))]; } },
  { id: '45-45', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 4, at: (k) => { const t = [8, 10, 12, 16][k]!; return t > 12 ? [`45"/45" · 2×${t / 2}`, q(series(2, `${t / 2}×(45" Z6 + R45")`))] : [`45"/45" · ${t}`, q(`${t}×(45" Z6 + R45")`)]; } },
  { id: '200m', category: 'intervals', levels: ALL, phases: ['base', 'developpement'], tiers: 4, at: (k, n) => { const r = lerp(6, 12, k, n); return [`Fractionné ${r}×200 m`, q(`${r}×(200m Z7 + R200m)`)]; } },
  { id: '200m-series', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(6, 10, k, n); return [`Fractionné 2×${r}×200 m`, q(series(2, `${r}×(200m Z7 + R200m)`))]; } },
  { id: '300m', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(6, 10, k, n); return [`Fractionné ${r}×300 m`, q(`${r}×(300m Z7 + R200m)`)]; } },
  { id: '1-1', category: 'intervals', levels: ALL, phases: ['base', 'developpement'], tiers: 5, at: (k, n) => { const r = lerp(6, 15, k, n); return [`Fractionné ${r}×1'/1'`, q(`${r}×(1' Z6 + R1')`)]; } },
  { id: '400m', category: 'intervals', levels: ALL, phases: ['developpement'], tiers: 5, at: (k, n) => { const r = lerp(5, 12, k, n); return [`Fractionné ${r}×400 m`, q(`${r}×(400m Z6 + R1'30)`)]; } },
  { id: '400m-series', category: 'intervals', levels: IC, phases: ['developpement', 'specifique'], tiers: 3, at: (k, n) => { const r = lerp(5, 7, k, n); return [`Fractionné 2×${r}×400 m`, q(series(2, `${r}×(400m Z6 + R1'30)`))]; } },
  { id: '500m', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(5, 8, k, n); return [`Fractionné ${r}×500 m`, q(`${r}×(500m Z6 + R1'30)`)]; } },
  { id: 'mixte-200-400', category: 'intervals', levels: ALL, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`Mixte ${r}×200 m + ${r}×400 m`, q(`${r}×(200m Z7 + R200m) + 3' Z1 + ${r}×(400m Z6 + R1'30)`)]; } },
  // ——— VMA longue ———
  { id: '2min', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 6, at: (k) => { const t = [5, 6, 7, 8, 10, 12][k]!; return t > 8 ? [`VMA moyenne 2×${Math.ceil(t / 2)}×2'`, q(series(2, `${Math.ceil(t / 2)}×(2' Z6 + R1'30)`))] : [`VMA moyenne ${t}×2'`, q(`${t}×(2' Z6 + R1'30)`)]; } },
  { id: '600m', category: 'intervals', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(5, 8, k, n); return [`Fractionné ${r}×600 m`, q(`${r}×(600m Z5 + R2')`)]; } },
  { id: '3min', category: 'intervals', levels: IC, phases: ['developpement', 'specifique'], tiers: 4, at: (k, n) => { const r = lerp(4, 8, k, n); return [`VMA longue ${r}×3'`, q(`${r}×(3' Z5 + R2')`)]; } },
  { id: '4min', category: 'intervals', levels: IC, phases: ['developpement', 'specifique'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`VMA longue ${r}×4'`, q(`${r}×(4' Z5 + R2'30)`)]; } },
  { id: '800m', category: 'intervals', levels: IC, phases: ['developpement', 'specifique'], tiers: 4, at: (k, n) => { const r = lerp(4, 8, k, n); return [`Fractionné ${r}×800 m`, q(`${r}×(800m Z5 + R2')`)]; } },
  { id: '1km', category: 'intervals', levels: ALL, phases: ['developpement', 'specifique'], tiers: 4, at: (k, n) => { const r = lerp(3, 6, k, n); return [`Fractionné ${r}×1 km`, q(`${r}×(1km Z5 + R2'30)`)]; } },
  // ——— Seuil et tempo ———
  { id: 'tempo-continu', category: 'tempo', levels: ALL, phases: ['developpement', 'specifique'], tiers: 5, at: (k, n) => { const m = lerp(15, 40, k, n, 5); return [`Tempo continu ${m}'`, q(`${m}' Z3`)]; } },
  { id: 'endurance-active', category: 'tempo', levels: ALL, phases: ['developpement'], tiers: 5, at: (k, n) => { const r = lerp(2, 3, k, n), d = lerp(10, 15, k, n); return [`Endurance active ${r}×${d}'`, q(`${r}×(${d}' Z3 + R3')`)]; } },
  { id: 'seuil-temps', category: 'threshold', levels: ALL, phases: ['developpement', 'specifique'], tiers: 10, at: (k, n) => { const d = lerp(6, 15, k, n); return [`Seuil 3×${d}'`, q(`3×(${d}' Z4 + R2')`)]; } },
  { id: 'seuil-1km', category: 'threshold', levels: ALL, phases: ['developpement'], tiers: 5, at: (k, n) => { const r = lerp(4, 8, k, n), s = lerp(180, 90, k, n, 15); return [`Seuil ${r}×1 km (R${rec(s)})`, q(`${r}×(1km Z4 + R${rec(s)})`)]; } },
  { id: 'seuil-1200', category: 'threshold', levels: IC, phases: ['developpement', 'specifique'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`Seuil ${r}×1200 m`, q(`${r}×(1200m Z4 + R2')`)]; } },
  { id: 'seuil-2000', category: 'threshold', levels: IC, phases: ['specifique'], tiers: 3, at: (k, n) => { const r = lerp(2, 4, k, n); return [`Seuil ${r}×2000 m`, q(`${r}×(2000m Z4 + R3')`)]; } },
  { id: 'seuil-3000', category: 'threshold', levels: ['C'], phases: ['specifique'], tiers: 2, at: (k, n) => { const r = lerp(2, 3, k, n); return [`Seuil ${r}×3000 m`, q(`${r}×(3000m Z4 + R3')`)]; } },
  { id: 'seuil-continu', category: 'threshold', levels: IC, phases: ['specifique'], tiers: 4, at: (k, n) => { const m = lerp(15, 30, k, n, 5); return [`Seuil continu ${m}'`, q(`${m}' Z4`)]; } },
  { id: 'seuil-vma', category: 'threshold', levels: IC, phases: ['developpement', 'specifique'], tiers: 3, at: (k) => { const [r, d] = ([[2, 8], [2, 10], [3, 8]] as const)[k]!; return [`Seuil + vitesse ${r}×${d}' + 6×30"`, q(`${r}×(${d}' Z4 + R2') + 3' Z1 + 6×(30" Z7 + R30")`)]; } },
  // ——— Allure spécifique (allure de l’objectif) ———
  { id: 'allure-temps', category: 'race', levels: ALL, phases: ['specifique'], tiers: 8, at: (k, n) => { const r = lerp(2, 3, k, n), d = lerp(8, 15, k, n); return [`Allure course ${r}×${d}'`, q(`${r}×(${d}' Z4 « allure course » + R2')`)]; } },
  { id: 'allure-1km', category: 'race', levels: ALL, phases: ['specifique'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`Allure course ${r}×1 km`, q(`${r}×(1km Z4 « allure course » + R1'30)`)]; } },
  { id: 'allure-2km', category: 'race', levels: IC, phases: ['specifique'], tiers: 3, at: (k, n) => { const r = lerp(3, 5, k, n); return [`Allure course ${r}×2 km`, q(`${r}×(2km Z4 « allure course » + R2')`)]; } },
  { id: 'allure-3km', category: 'race', levels: IC, phases: ['specifique'], tiers: 4, at: (k) => { const [r, l] = ([[3, 3], [4, 3], [3, 4], [3, 5]] as const)[k]!; return [`Allure course ${r}×${l} km`, q(`${r}×(${l}km Z4 « allure course » + R3')`)]; } },
  { id: 'allure-continu-km', category: 'race', levels: IC, phases: ['specifique'], tiers: 6, at: (k, n) => { const d = lerp(4, 12, k, n); return [`Allure course ${d} km en continu`, q(`${d}km Z4 « allure course »`)]; } },
  { id: 'allure-continu-temps', category: 'race', levels: ALL, phases: ['specifique'], tiers: 3, at: (k, n) => { const m = lerp(20, 40, k, n, 5); return [`Allure course ${m}' en continu`, q(`${m}' Z4 « allure course »`)]; } },
  { id: 'rappel-500', category: 'race', levels: ALL, phases: ['affutage'], tiers: 3, at: (k, n) => { const r = lerp(3, 5, k, n); return [`Rappel d’allure ${r}×500 m`, q(`${r}×(500m Z4 « allure course » + R1'30)`)]; } },
  { id: 'rappel-1km', category: 'race', levels: ALL, phases: ['affutage'], tiers: 2, at: (k, n) => { const r = lerp(2, 3, k, n); return [`Rappel d’allure ${r}×1 km`, q(`${r}×(1km Z4 « allure course » + R2')`)]; } },
  { id: 'rappel-2min', category: 'race', levels: ALL, phases: ['affutage'], tiers: 2, at: (k, n) => { const r = lerp(3, 4, k, n); return [`Rappel d’allure ${r}×2'`, q(`${r}×(2' Z4 « allure course » + R1'30)`)]; } },
  // ——— Côtes ———
  { id: 'cotes-intro', category: 'hills', levels: ['D', 'I'], phases: ['reprise', 'base'], tiers: 3, at: (k, n) => { const r = lerp(4, 8, k, n, 2); return [`Footing + ${r} côtes de 20"`, `30' Z2 + ${r}×(20" Z6 + R1' « en côte ; descente en trottinant »)`]; } },
  { id: 'cotes-30', category: 'hills', levels: ALL, phases: ['base', 'developpement'], tiers: 4, at: (k, n) => { const r = lerp(6, 12, k, n, 2); return [`Côtes ${r}×30"`, q(`${r}×(30" Z6 + R1'30 « en côte ; descente en récupération »)`)]; } },
  { id: 'cotes-45', category: 'hills', levels: IC, phases: ['base', 'developpement'], tiers: 3, at: (k, n) => { const r = lerp(6, 10, k, n, 2); return [`Côtes ${r}×45"`, q(`${r}×(45" Z6 + R1'30 « en côte ; descente en récupération »)`)]; } },
  { id: 'cotes-1', category: 'hills', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(5, 8, k, n); return [`Côtes ${r}×1'`, q(`${r}×(1' Z5 « côte » + R2' « descente »)`)]; } },
  { id: 'cotes-2', category: 'hills', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`Côtes ${r}×2'`, q(`${r}×(2' Z5 « côte » + R2'30 « descente »)`)]; } },
  { id: 'sprints-cote', category: 'hills', levels: IC, phases: ['base', 'developpement'], tiers: 2, at: (k, n) => { const r = lerp(8, 10, k, n, 2); return [`Sprints en côte ${r}×30"`, q(`${r}×(30" Z7 + R1'30 « en côte ; descente en récupération »)`)]; } },
  { id: 'montees-300', category: 'hills', levels: IC, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(6, 10, k, n, 2); return [`Montées ${r}×300 m`, q(`${r}×(300m Z5 « côte » + R2' « descente »)`)]; } },
  // ——— Fartlek ———
  { id: 'pyramide', category: 'intervals', levels: ALL, phases: ['developpement'], tiers: 3, at: (k) => { const p = [[1, 2, 3, 2, 1], [1, 2, 3, 3, 2, 1], [1, 2, 3, 4, 3, 2, 1]][k]!; return [`Pyramide ${p.join('-')}'`, q(p.map((m) => `${m}' Z5 + R1'`).join(' + '))]; } },
  { id: 'degressif', category: 'intervals', levels: ALL, phases: ['developpement'], tiers: 3, at: (k) => { const p = [[4, 3, 2, 1], [5, 3, 2, 1], [5, 4, 3, 2, 1]][k]!; return [`Dégressif ${p.join('-')}'`, q(p.map((m) => `${m}' Z5 + R1'30`).join(' + '))]; } },
  { id: 'fartlek-2-2', category: 'intervals', levels: ALL, phases: ['base', 'developpement'], tiers: 3, at: (k, n) => { const r = lerp(5, 8, k, n); return [`Fartlek ${r}×2'/2'`, q(`${r}×(2' Z5 + R2')`)]; } },
  { id: 'fartlek-3-2', category: 'intervals', levels: ALL, phases: ['developpement'], tiers: 3, at: (k, n) => { const r = lerp(4, 6, k, n); return [`Fartlek ${r}×3'/2'`, q(`${r}×(3' Z5 + R2')`)]; } },
  { id: 'fartlek-1-2', category: 'intervals', levels: ALL, phases: ['base', 'developpement'], tiers: 2, at: (k, n) => { const r = lerp(6, 8, k, n); return [`Fartlek ${r}×1'/2'`, q(`${r}×(1' Z6 + R2')`)]; } },
  // ——— Tests ———
  { id: 'test', category: 'race', levels: ALL, phases: ['reprise', 'base', 'affutage'], tiers: 2, at: (k) => { const d = [3, 5][k]!; return [`Test ${d} km`, q(`${d}km Z5 « test : le plus vite possible, allure régulière »`)]; } },
  { id: 'test-vma', category: 'race', levels: IC, phases: ['base'], tiers: 1, at: () => [`Test VMA 6'`, q(`6' Z6 « test : la plus grande distance possible en 6 minutes »`)] },
  { id: 'test-30', category: 'race', levels: ['C'], phases: ['base', 'developpement'], tiers: 1, at: () => [`Test 30' en continu`, q(`30' Z4 « test : allure la plus rapide tenue 30 minutes »`)] },
  // ——— Renforcement et mobilité (renfo_ppg) ———
  { id: 'renfo', category: 'strength', levels: ALL, phases: EVERY, tiers: 4, at: (k, n) => { const m = lerp(10, 30, k, n, 5); return [m < 20 ? `Renfo express ${m}'` : `PPG ${m}'`, `${m}' « gainage, squats, fentes, mollets »`]; } },
  { id: 'footing-renfo', category: 'strength', levels: ALL, phases: EVERY, tiers: 3, at: (k, n) => { const m = lerp(20, 30, k, n, 5), r = lerp(10, 15, k, n); return [`Footing ${m}' + renfo ${r}'`, `${m}' Z2 + ${r}' « renforcement : gainage, squats, fentes »`]; } },
  { id: 'renfo-coureur', category: 'strength', levels: ALL, phases: EVERY, tiers: 5, at: (k, n) => { const t = ['les bases', null, null, null, 'avec charges'][k]; return [`Renfo coureur ${k + 1}${t ? ` : ${t}` : ''}`, `${lerp(20, 30, k, n, 5)}' « renforcement du coureur, niveau ${k + 1} »`]; } },
  { id: 'footing-renfo-coureur', category: 'strength', levels: ALL, phases: EVERY, tiers: 5, at: (k, n) => { const m = lerp(20, 40, k, n, 5); return [`Footing ${m}' + renfo coureur ${k + 1}`, `${m}' Z2 + 15' « renforcement du coureur, niveau ${k + 1} »`]; } },
  { id: 'mobilite', category: 'technique', levels: ALL, phases: EVERY, tiers: 3, at: (k, n) => { const m = lerp(10, 20, k, n, 5); return [k === n - 1 ? `Mobilité ${m}' hanches, chevilles et dos` : `Mobilité ${m}'`, `${m}' « mobilité : hanches, chevilles, dos »`]; } },
  { id: 'pliometrie', category: 'strength', levels: IC, phases: ['base', 'developpement', 'specifique'], tiers: 3, at: (k) => { const t = ['corde et sautillés', null, 'sauts enchaînés'][k]; return [`Pliométrie ${k + 1}${t ? ` : ${t}` : ''}`, `15' Z2 + 15' « pliométrie, niveau ${k + 1} »`]; } },
];

/** Métadonnées gardées avec la séance (payload.meta) : le générateur respecte niveaux et phases (D-068). */
export interface FouleeMeta {
  source: 'foulee'; family: string; tier: number; tiers: number; levels: FouleeLevel[]; phases: FouleePhase[];
  /** Palier calculé par CoachOS entre le premier et le dernier de la famille (validé par le fondateur, D-077). */
  calculated?: boolean;
}
export interface FouleeSession { family: string; tier: number; tiers: number; interpolated: boolean; category: LibraryCategory; workout: LibraryWorkout; errors: number; meta: FouleeMeta }

/** Les 324 séances, famille par famille, du palier le plus léger au plus chargé. */
export function fouleeLibrary(): FouleeSession[] {
  const out: FouleeSession[] = [];
  for (const f of F) {
    for (let k = 0; k < f.tiers; k++) {
      const [title, notation] = f.at(k, f.tiers);
      const parsed = parseNotation(notation, 'running');
      const interpolated = k > 0 && k < f.tiers - 1;
      out.push({
        family: f.id, tier: k + 1, tiers: f.tiers, interpolated, category: f.category, errors: parsed.errors.length,
        meta: { source: 'foulee', family: f.id, tier: k + 1, tiers: f.tiers, levels: f.levels, phases: f.phases, calculated: interpolated },
        // Pas de consignes : l’élève lit les consignes d’une séance publiée ; les repères Foulée restent dans meta (D-077).
        workout: { sport: 'running', title, instructions: null, durationSeconds: null, distanceM: null, intervals: parsed.blocks as Block[] } as LibraryWorkout,
      });
    }
  }
  return out;
}

export const FOULEE_FAMILY_COUNT = F.length;

/** Niveau CoachOS → niveau Foulée. */
export const FOULEE_LEVEL_OF: Record<'beginner' | 'intermediate' | 'advanced' | 'competitive', FouleeLevel> = { beginner: 'D', intermediate: 'I', advanced: 'C', competitive: 'C' };
/** Phase du générateur → phases Foulée où la séance a sa place. */
export const FOULEE_PHASES_OF: Record<'tremplin' | 'developpement' | 'recuperation' | 'affutage', FouleePhase[]> = {
  tremplin: ['reprise', 'base'], developpement: ['base', 'developpement', 'specifique'], recuperation: ['base', 'developpement'], affutage: ['affutage', 'specifique'],
};

