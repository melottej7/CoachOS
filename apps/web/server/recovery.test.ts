import { describe, expect, it } from 'vitest';
import { CONFIRM_TYPES, normalizeCode } from './auth/recovery';

describe('code de « Mot de passe oublié » (bilan produit, iPhone)', () => {
  it('accepte 6 chiffres, espaces compris, et rien d’autre', () => {
    expect(normalizeCode('123456')).toBe('123456');
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('1234567')).toBeNull();
    expect(normalizeCode('12a456')).toBeNull();
  });
  it('ne vérifie que les types de lien connus', () => {
    expect(CONFIRM_TYPES).toEqual(['recovery', 'signup', 'email', 'invite']);
  });
});
