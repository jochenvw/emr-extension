import { useEffect, useRef, useState } from 'react';
import { resetRuns } from '../agent/runs';
import { useDemo } from '../context';
import { GUIDE, stateAtStep } from '../engine/guide';

export function GuideBar() {
  const { state: s, dispatch, step, setStep } = useDemo();
  const [busy, setBusy] = useState(false);
  const timers = useRef<number[]>([]);
  const cur = GUIDE[step];
  const next = GUIDE[step + 1];
  const waiting = cur.ready ? !cur.ready(s) : false;

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const go = () => {
    if (!next || busy || waiting) return;
    clear();
    setStep(step + 1);
    setBusy(true);
    next.enter.forEach((a, i) => {
      timers.current.push(window.setTimeout(() => dispatch(a), 350 + i * 650));
    });
    timers.current.push(window.setTimeout(() => setBusy(false), 450 + next.enter.length * 650));
  };

  const jump = (k: number) => {
    clear();
    setBusy(false);
    resetRuns();
    dispatch({ type: 'replace', state: stateAtStep(k) });
    setStep(k);
  };

  // Clinician did the step manually – follow along.
  useEffect(() => {
    if (busy || !next) return;
    if (cur.advanceWhen?.(s)) setStep(step + 1);
  }, [s, busy, cur, next, step, setStep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.key === 'ArrowRight') go();
      if (e.key === 'ArrowLeft' && step > 0) jump(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => clear, []);

  return (
    <div className="guide" data-testid="guide">
      <div className="guide-steps">
        {GUIDE.map((g, i) => (
          <button
            key={g.id}
            type="button"
            className={`gstep ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
            onClick={() => jump(i)}
            title={g.title}
            aria-label={`Step ${i + 1}: ${g.title}`}
          >
            <span>{i + 1}</span>
            <em>{g.title}</em>
          </button>
        ))}
      </div>
      <div className="guide-text">
        <strong data-testid="guide-headline">{cur.headline}</strong>
        <p>{cur.explain}</p>
      </div>
      <div className="guide-actions">
        {step > 0 && (
          <button type="button" className="guide-back" onClick={() => jump(0)} title="Restart">
            ↺
          </button>
        )}
        {next ? (
          <button type="button" className="guide-next" disabled={busy || waiting} onClick={go} data-testid="guide-next">
            {waiting ? cur.waitLabel ?? 'Waiting…' : busy ? '…' : `${next.cta} →`}
          </button>
        ) : (
          <button type="button" className="guide-next" onClick={() => jump(0)}>
            ↺ Run it again
          </button>
        )}
      </div>
    </div>
  );
}
