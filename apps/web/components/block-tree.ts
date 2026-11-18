// Déplacement de blocs dans l’arbre du constructeur (glisser-déposer, clavier, menu).
// Repérage par clé stable (_k) : pas de décalage d’indices quand on retire puis insère.

export type TreeBlock = { type: 'step' | 'repeat'; _k: string; steps?: TreeBlock[] };

/** Cible : liste (null = racine, sinon clé de la répétition) et bloc devant lequel insérer (null = à la fin). */
export interface DropTarget { parent: string | null; before: string | null }

export function find<B extends TreeBlock>(blocks: B[], key: string, parent: string | null = null, depth = 0): { block: B; parent: string | null; depth: number; index: number; list: B[] } | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b._k === key) return { block: b, parent, depth, index: i, list: blocks };
    if (b.type === 'repeat' && b.steps) {
      const r = find(b.steps as B[], key, b._k, depth + 1);
      if (r) return r;
    }
  }
  return null;
}

/** Profondeur d’une liste : 0 racine, 1 dans une répétition, 2 dans une série imbriquée. */
export function listDepth<B extends TreeBlock>(blocks: B[], parent: string | null): number {
  if (parent === null) return 0;
  const f = find(blocks, parent);
  return f ? f.depth + 1 : -1;
}

const hasRepeat = (b: TreeBlock): boolean => Boolean(b.steps?.some((s) => s.type === 'repeat'));
const contains = (b: TreeBlock, key: string): boolean => b._k === key || Boolean(b.steps?.some((s) => contains(s, key)));

/** Respecte le schéma : répétition à la racine, ou dans une répétition si elle ne contient pas de série. */
export function canDrop<B extends TreeBlock>(blocks: B[], key: string, target: DropTarget): boolean {
  const moving = find(blocks, key)?.block;
  if (!moving) return false;
  if (target.parent !== null && contains(moving, target.parent)) return false;
  const depth = listDepth(blocks, target.parent);
  if (depth < 0) return false;
  if (moving.type === 'step') return depth <= 2;
  return depth === 0 || (depth === 1 && !hasRepeat(moving));
}

function without<B extends TreeBlock>(blocks: B[], key: string): B[] {
  return blocks
    .filter((b) => b._k !== key)
    .map((b) => (b.type === 'repeat' && b.steps ? ({ ...b, steps: without(b.steps as B[], key) } as B) : b));
}

function insert<B extends TreeBlock>(blocks: B[], block: B, target: DropTarget, parent: string | null = null): B[] {
  if (parent === target.parent) {
    const i = target.before === null ? blocks.length : blocks.findIndex((b) => b._k === target.before);
    const at = i < 0 ? blocks.length : i;
    return [...blocks.slice(0, at), block, ...blocks.slice(at)];
  }
  return blocks.map((b) => (b.type === 'repeat' && b.steps ? ({ ...b, steps: insert(b.steps as B[], block, target, b._k) } as B) : b));
}

/** Déplace le bloc `key` vers `target`. Retourne la liste inchangée si le déplacement est interdit. */
export function moveBlock<B extends TreeBlock>(blocks: B[], key: string, target: DropTarget): B[] {
  if (target.before === key || !canDrop(blocks, key, target)) return blocks;
  const moving = find(blocks, key)!.block;
  const next = insert(without(blocks, key), moving, target);
  // Une répétition vidée garde au moins une étape : on refuse plutôt que de casser le schéma.
  const empty = (bs: TreeBlock[]): boolean => bs.some((b) => b.type === 'repeat' && (!b.steps?.length || empty(b.steps)));
  return empty(next) ? blocks : next;
}

/** Monter (-1) ou descendre (+1) dans la même liste. */
export function shift<B extends TreeBlock>(blocks: B[], key: string, d: -1 | 1): B[] {
  const f = find(blocks, key);
  if (!f) return blocks;
  const j = f.index + d;
  if (j < 0 || j >= f.list.length) return blocks;
  const before = d < 0 ? f.list[j]!._k : (f.list[j + 1]?._k ?? null);
  return moveBlock(blocks, key, { parent: f.parent, before });
}

/** Sortir d’une répétition : placé juste après elle. */
export function lift<B extends TreeBlock>(blocks: B[], key: string): B[] {
  const f = find(blocks, key);
  if (!f || f.parent === null) return blocks;
  const p = find(blocks, f.parent)!;
  return moveBlock(blocks, key, { parent: p.parent, before: p.list[p.index + 1]?._k ?? null });
}
