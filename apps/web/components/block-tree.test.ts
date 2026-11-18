import { describe, expect, it } from 'vitest';
import { canDrop, lift, moveBlock, shift, type TreeBlock } from './block-tree';

const s = (k: string): TreeBlock => ({ type: 'step', _k: k });
const r = (k: string, steps: TreeBlock[]): TreeBlock => ({ type: 'repeat', _k: k, steps });
const keys = (bs: TreeBlock[]): unknown => bs.map((b) => (b.type === 'repeat' ? { [b._k]: keys(b.steps!) } : b._k));

describe('déplacement des blocs du constructeur', () => {
  const tree = [s('a'), r('R', [s('b'), s('c')]), s('d')];

  it('réordonne dans la même liste, avant ou à la fin', () => {
    expect(keys(moveBlock(tree, 'd', { parent: null, before: 'a' }))).toEqual(['d', 'a', { R: ['b', 'c'] }]);
    expect(keys(moveBlock(tree, 'a', { parent: null, before: null }))).toEqual([{ R: ['b', 'c'] }, 'd', 'a']);
    expect(keys(moveBlock(tree, 'c', { parent: 'R', before: 'b' }))).toEqual(['a', { R: ['c', 'b'] }, 'd']);
  });

  it('entre dans une répétition et en sort', () => {
    expect(keys(moveBlock(tree, 'a', { parent: 'R', before: 'c' }))).toEqual([{ R: ['b', 'a', 'c'] }, 'd']);
    expect(keys(lift(tree, 'b'))).toEqual(['a', { R: ['c'] }, 'b', 'd']);
  });

  it('respecte le schéma : pas de répétition dans elle-même, pas de 3e niveau, pas de répétition vide', () => {
    const nested = [r('R', [r('S', [s('x')]), s('y')]), r('T', [s('z')])];
    expect(canDrop(nested, 'R', { parent: 'S', before: null })).toBe(false);
    expect(canDrop(nested, 'T', { parent: 'S', before: null })).toBe(false);
    expect(canDrop(nested, 'T', { parent: 'R', before: null })).toBe(true);
    expect(canDrop(nested, 'R', { parent: 'T', before: null })).toBe(false);
    // Retirer la dernière étape d’une répétition est refusé.
    expect(moveBlock(nested, 'x', { parent: null, before: null })).toBe(nested);
  });

  it('monte et descend au clavier', () => {
    expect(keys(shift(tree, 'd', -1))).toEqual(['a', 'd', { R: ['b', 'c'] }]);
    expect(keys(shift(tree, 'b', 1))).toEqual(['a', { R: ['c', 'b'] }, 'd']);
    expect(shift(tree, 'a', -1)).toBe(tree);
  });
});
