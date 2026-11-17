'use client';

import { useId, useState } from 'react';

/** Champ mot de passe avec affichage optionnel (plus sûr qu’une double saisie sur téléphone). */
export function PasswordInput({ name = 'password', autoComplete, hint, label = 'Mot de passe', minLength }: {
  name?: string;
  autoComplete: 'current-password' | 'new-password';
  hint?: string;
  label?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} {hint ? <span className="hint">{hint}</span> : null}</label>
      <input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required minLength={minLength} maxLength={72} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: 14, minHeight: 36 }}>
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} style={{ width: 18, height: 18, minHeight: 0 }} />
        Afficher le mot de passe
      </label>
    </div>
  );
}
