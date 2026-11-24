// Reste de l’ancien kit : initiales d’un nom, encore utilisées par la messagerie (D-157).

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
