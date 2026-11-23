'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from './mascot';
import { matchPath, placeName, TOURS, type TourId } from './tours';

type State = { id: TourId; step: number } | null;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string | null) { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch { /* stockage indisponible */ } },
};

/** Texte qui s’écrit lettre par lettre (sauf mouvement réduit) ; un toucher le complète. */
function Typed({ text, onTyping }: { text: string; onTyping?: (typing: boolean) => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reducedMotion()) { setN(text.length); return; }
    setN(0);
    const t = setInterval(() => setN((c) => (c >= text.length ? (clearInterval(t), c) : c + 2)), 22);
    return () => clearInterval(t);
  }, [text]);
  const typing = n < text.length;
  useEffect(() => { onTyping?.(typing); }, [typing, onTyping]);
  return (
    <span onClick={() => setN(text.length)}>
      <span aria-hidden="true">{text.slice(0, n)}</span>
      <span className="visually-hidden">{text}</span>
    </span>
  );
}

/**
 * Visite du guide CoachOS sur les vrais écrans (CE-C-01, D-028). Inspirée de Foulée :
 * personnage en pied qui montre l’élément, projecteur, barre « Passer · Voix · points · Suivant »,
 * progression par action.
 * L’état est gardé dans ce navigateur (commodité, pas de donnée métier).
 */
export function TourHost({ space, wid }: { space: 'athlete' | 'coach'; wid: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startParam = searchParams.get('tour');
  const router = useRouter();
  const root = space === 'athlete' ? `/athlete/${wid}` : `/coach/${wid}`;
  const key = `coachos_tour:${wid}:${space}`;
  const [state, setState] = useState<State>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [status, setStatus] = useState<'searching' | 'shown' | 'elsewhere'>('searching');
  const [voice, setVoice] = useState(false);
  const target = useRef<Element | null>(null);
  // Sens du dernier déplacement : une étape facultative absente se saute dans ce sens.
  const dir = useRef<1 | -1>(1);
  const [found, setFound] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  const save = useCallback((s: State) => {
    setState(s);
    store.set(key, s ? JSON.stringify(s) : null);
  }, [key]);

  const start = useCallback(() => {
    const id: TourId = space === 'athlete' ? 'athlete' : document.querySelector('[data-tour="add-athlete"]') ? 'coach-empty' : 'coach';
    dir.current = 1;
    save({ id, step: 0 });
    if (!matchPath(TOURS[id][0]!.path, window.location.pathname, root)) router.push(TOURS[id][0]!.href?.(wid) ?? root);
  }, [space, save, root, router, wid]);

  const finish = useCallback(() => {
    save(null);
    store.set(`${key}:seen`, '1');
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }, [save, key]);

  const go = useCallback((delta: number) => {
    dir.current = delta < 0 ? -1 : 1;
    setState((cur) => {
      if (!cur) return cur;
      const next = cur.step + delta;
      if (next >= TOURS[cur.id].length) { store.set(key, null); store.set(`${key}:seen`, '1'); return null; }
      const s = { id: cur.id, step: Math.max(0, next) };
      store.set(key, JSON.stringify(s));
      return s;
    });
  }, [key]);

  // Reprise et démarrage par l’adresse (?tour=start).
  useEffect(() => {
    setVoice(store.get('coachos_tour_voice') === '1');
    const url = new URL(window.location.href);
    if (url.searchParams.get('tour') === 'start') {
      url.searchParams.delete('tour');
      window.history.replaceState(null, '', url.pathname + (url.search ? url.search : ''));
      setTimeout(start, 300);
      return;
    }
    const raw = store.get(key);
    if (raw) { try { setState(JSON.parse(raw) as State); } catch { store.set(key, null); } }
    // Relancé à chaque navigation : la mise en page reste montée entre les pages de l’espace.
  }, [key, start, pathname, startParam]);

  const step = state ? TOURS[state.id][state.step] : null;

  // Résolution de l’élément visé sur la page courante.
  useEffect(() => {
    target.current = null;
    setRect(null);
    setFound(null);
    if (!step) return;
    if (!matchPath(step.path, pathname, root)) {
      // Une navigation peut être en cours (étape « action ») : attendre avant de conclure.
      setStatus('searching');
      const wait = setTimeout(() => (step.optional ? go(dir.current) : setStatus('elsewhere')), dir.current < 0 ? 0 : 1500);
      return () => clearTimeout(wait);
    }
    if (!step.targets?.length) { setStatus('shown'); return; }
    setStatus('searching');
    let tries = 0;
    const find = () => {
      const el = step.targets!.map((t) => document.querySelector(`[data-tour="${t}"]`)).find(Boolean) ?? null;
      if (el) {
        target.current = el;
        setFound(el.getAttribute('data-tour'));
        el.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
        setStatus('shown');
        return;
      }
      if (++tries < 15) { timer = setTimeout(find, 100); return; }
      if (step.optional) go(dir.current);
      else setStatus('shown');
    };
    let timer = setTimeout(find, 50);
    return () => clearTimeout(timer);
  }, [step, pathname, root, go]);

  // Suivi de la position (défilement, redimensionnement, contenu qui bouge).
  useEffect(() => {
    if (status !== 'shown' || !target.current) return;
    let frame = 0;
    const loop = () => {
      const el = target.current;
      if (el && el.isConnected) setRect(el.getBoundingClientRect());
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [status, step]);

  // Étape « action » : avancer quand l’élément visé est touché.
  useEffect(() => {
    const el = target.current;
    if (!step || step.action !== 'click' || !el || status !== 'shown') return;
    const onClick = () => go(1);
    el.addEventListener('click', onClick, { capture: true });
    return () => el.removeEventListener('click', onClick, { capture: true });
  }, [step, status, go]);

  // Voix française facultative.
  useEffect(() => {
    if (!step || !voice || typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(step.text);
    u.lang = 'fr-FR';
    speechSynthesis.speak(u);
  }, [step, voice]);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, finish]);

  const total = state ? TOURS[state.id].length : 0;
  const onTop = rect ? rect.top + rect.height / 2 > window.innerHeight * 0.55 : false;
  const pad = 6;

  const pose = status === 'shown' && rect ? (onTop ? 'point-down' : 'point-up') : 'wave';
  const where = step && status === 'elsewhere' ? placeName(step.path) : null;

  return (
    <>
      <button type="button" className={`guide-fab ${space}${step && !step.targets?.includes('guide-help') ? ' is-hidden' : ''}${step ? '' : ' is-idle'}`} data-tour="guide-help" onClick={start} aria-label="Revoir la visite guidée" title="Revoir la visite guidée">
        <Mascot size={52} />
      </button>
      {/* Pendant la recherche de l’élément ou l’attente d’une navigation, rien n’est affiché. */}
      {step && state && status !== 'searching' ? (
        <>
          {rect && status === 'shown' ? (
            <div className="tour-spot" aria-hidden="true"
              style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
          ) : <div className="tour-dim" aria-hidden="true" />}
          <div className={`tour-panel ${onTop ? 'at-top' : 'at-bottom'}`} role="dialog" aria-modal="false" aria-label="Visite guidée CoachOS">
            <div className="tour-talk">
              <span className="tour-mascot" key={`${state.id}-${state.step}`}>
                <Mascot full size={88} mood={step.mood} pose={pose} talking={typing && status === 'shown'} />
              </span>
              <p className="bubble" aria-live="polite">
                {where ? (
                  <>La suite de la visite se passe sur {where.startsWith('la ') || where.startsWith('une ') ? where : <>la page « {where} »</>}.
                    <span className="tour-where">{step.href ? 'Je t’y emmène ?' : 'Ouvre-la, je reprendrai là-bas. Tu peux aussi passer cette étape.'}</span></>
                ) : <Typed text={(found && step.textFor?.[found]) || step.text} onTyping={setTyping} />}
              </p>
            </div>
            <div className="tour-bar">
              <button type="button" className="link-btn" onClick={finish}>{where ? 'Arrêter la visite' : 'Passer'}</button>
              <button type="button" className="link-btn" aria-pressed={voice}
                onClick={() => { const v = !voice; setVoice(v); store.set('coachos_tour_voice', v ? '1' : '0'); if (!v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); }}>
                {voice ? '🔊 Voix' : '🔈 Voix'}
              </button>
              <span className="tour-dots" aria-label={`Étape ${state.step + 1} sur ${total}`}>
                {Array.from({ length: total }, (_, k) => <span key={k} className={k === state.step ? 'on' : ''} />)}
              </span>
              {state.step > 0 && !where ? <button type="button" className="btn small" onClick={() => go(-1)}>Précédent</button> : null}
              {where ? (
                step.href
                  ? <button type="button" className="btn primary small" onClick={() => router.push(step.href!(wid))}>Y aller</button>
                  : <button type="button" className="btn primary small" onClick={() => go(1)}>Passer cette étape</button>
              ) : step.action === 'click' && target.current ? (
                <span className="tour-hint">Touche l’élément en surbrillance</span>
              ) : (
                <button type="button" className="btn primary small" onClick={() => go(1)}>{state.step + 1 === total ? 'Terminer' : 'Suivant'}</button>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
