import type { z } from 'zod';

export interface FieldError {
  path: string;
  rule: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; fields: FieldError[] };

/** Valide une entrée et renvoie les erreurs par chemin (format errorBody.fields du contrat). */
export function parseWith<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    fields: result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '(body)',
      rule: issue.message,
    })),
  };
}
