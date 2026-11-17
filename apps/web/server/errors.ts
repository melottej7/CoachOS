import type { FieldError } from '@coachos/domain';

export type ErrorCode =
  | 'MALFORMED_REQUEST'
  | 'AUTH_REQUIRED_OR_INVALID_SIGNATURE'
  | 'ACTION_FORBIDDEN_OR_FEATURE_DISABLED'
  | 'RESOURCE_NOT_VISIBLE'
  | 'CONFLICT_OR_QUOTA'
  | 'INVALID_FIELDS'
  | 'RATE_LIMITED'
  | 'TEMPORARILY_UNAVAILABLE';

const STATUS: Record<ErrorCode, number> = {
  MALFORMED_REQUEST: 400,
  AUTH_REQUIRED_OR_INVALID_SIGNATURE: 401,
  ACTION_FORBIDDEN_OR_FEATURE_DISABLED: 403,
  RESOURCE_NOT_VISIBLE: 404,
  CONFLICT_OR_QUOTA: 409,
  INVALID_FIELDS: 422,
  RATE_LIMITED: 429,
  TEMPORARILY_UNAVAILABLE: 503,
};

/** Erreur métier sûre à renvoyer au client : message neutre, jamais de donnée athlète. */
export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly fields: FieldError[] | null = null,
    /** Contexte non sensible utile à la reprise côté client (ex. révision courante). */
    readonly details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notVisible = () => new AppError('RESOURCE_NOT_VISIBLE', 'Cette ressource n’est pas disponible.');
export const invalid = (fields: FieldError[]) =>
  new AppError('INVALID_FIELDS', 'Certains champs sont à corriger.', fields);
export const conflict = (message: string, details: Record<string, unknown> | null = null) =>
  new AppError('CONFLICT_OR_QUOTA', message, null, details);
