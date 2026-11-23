import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ErrorPage from '../app/error';
import GlobalError from '../app/global-error';

// D-117 · Pages d’erreur en français, sans détail technique, avec la référence du journal et un bouton « Réessayer ».
describe('pages d’erreur', () => {
  const error = Object.assign(new Error('détail interne secret'), { digest: 'abc123' });
  it('la page de segment affiche le message, la référence et les deux issues', () => {
    const html = renderToStaticMarkup(createElement(ErrorPage, { error, reset: () => undefined }));
    expect(html).toContain('Un problème est survenu');
    expect(html).toContain('abc123');
    expect(html).toContain('Réessayer');
    expect(html).toContain('/choose-workspace');
    expect(html).not.toContain('détail interne secret');
  });
  it('la page racine est autonome (html, body) et renvoie à la connexion', () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error, reset: () => undefined }));
    expect(html).toContain('<html lang="fr-BE">');
    expect(html).toContain('/login');
    expect(html).not.toContain('détail interne secret');
  });
});
