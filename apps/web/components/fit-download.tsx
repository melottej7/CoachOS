// Export FIT d’une séance (CE-X-01, D-044) : téléchargement direct, puis aide pour la montre.
// La procédure de copie reste « à confirmer » tant qu’elle n’a pas été essayée sur la Fenix 8 du fondateur (D-026).

export function FitDownload({ wid, aid, sid, label = 'Télécharger pour ma montre', compact = false }: {
  wid: string; aid: string; sid: string; label?: string; compact?: boolean;
}) {
  const href = `/media/workspaces/${wid}/athletes/${aid}/workouts/${sid}/fit`;
  if (compact) return <a className="btn" href={href} download>⌚ {label}</a>;
  return (
    <div className="fit-dl">
      <a className="btn" href={href} download>⌚ {label}</a>
      <details className="fit-help">
        <summary>Comment la mettre sur ma montre ?</summary>
        <ol>
          <li>Télécharge le fichier sur un ordinateur (il se termine par <code>.fit</code>).</li>
          <li>Branche ta montre Garmin avec son câble.</li>
          <li>Copie le fichier dans le dossier <strong>GARMIN › NewFiles</strong> de la montre, puis débranche-la.</li>
          <li>Sur la montre : <strong>Entraînement › Séances</strong>. Les cibles d’allure, de puissance ou de fréquence cardiaque sont reprises ; les zones sans VMA et le ressenti sont dans le nom ou la note de l’étape.</li>
        </ol>
        <p className="muted">Sur Mac, la montre n’apparaît pas toujours dans le Finder : il faut alors un outil de transfert compatible. Procédure en cours de vérification sur montre.</p>
      </details>
    </div>
  );
}
