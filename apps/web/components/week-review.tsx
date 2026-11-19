'use client';

import type { WeekReview } from '@coachos/domain';

// D-073 : résumé de la semaine, sans IA. « Poser la question » la met dans la conversation : rien n’est envoyé seul.

export function WeekReviewCard({ review, wid, aid, first, title }: { review: WeekReview; wid: string; aid: string; first: string; title: string }) {
  return (
    <div className="stack week-review">
      <p className="muted">{title}</p>
      <ul className="plain week-review-facts">{review.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>
      {review.question ? (
        <div className="week-review-q">
          <p><strong>Question à poser :</strong> {review.question}</p>
          <button type="button" className="btn small" onClick={() => {
            try { sessionStorage.setItem(`coachos:draft:${aid}`, review.question ?? ''); } catch { /* commodité seulement */ }
            window.location.href = `/coach/${wid}/messages/${aid}`;
          }}>✉️ Poser la question à {first}</button>
        </div>
      ) : null}
    </div>
  );
}
