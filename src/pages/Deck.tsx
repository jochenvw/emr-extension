import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PLUGINS } from '../engine/plugins';

type Slide = { title: ReactNode; body: ReactNode; notes: string };

const Chain = ({ items }: { items: string[] }) => (
  <div className="d-chain">
    {items.map((x, i) => (
      <span key={x} style={{ animationDelay: `${i * 180}ms` }}>
        {x}
      </span>
    ))}
  </div>
);

const SLIDES: Slide[] = [
  {
    title: (
      <>
        AI cannot use information <span className="grad">the hospital never captured.</span>
      </>
    ),
    body: <Chain items={['EMR constraints', 'information not captured / trapped in prose', 'poor data', 'limited agents + limited research']} />,
    notes: 'Open with the clinical moment, not the platform. The bottleneck is upstream of the data platform.',
  },
  {
    title: 'The current alternatives don’t scale.',
    body: (
      <div className="d-options">
        <div className="d-opt">
          <small>Option A</small>
          <strong>Put everything in the EMR</strong>
          <span>↓</span>
          <em>vendor dependency · slow innovation</em>
        </div>
        <div className="d-middle">
          Many innovations.
          <br />
          <span className="grad">Few platforms.</span>
        </div>
        <div className="d-opt">
          <small>Option B</small>
          <strong>Build 100 point solutions</strong>
          <span>↓</span>
          <em>operational chaos · fragmented UX</em>
        </div>
      </div>
    ),
    notes: 'Name both failure modes, then land the phrase in the middle.',
  },
  {
    title: 'Make the clinical environment extensible.',
    body: (
      <div className="d-planes">
        <div className="exp">
          <b>Experience</b> one clinical surface – contextual capabilities
        </div>
        <div className="inn">
          <b>Innovation</b> plugins: agents + UI + data + workflow
        </div>
        <div className="ctl">
          <b>Control</b> context · activation · auth · audit · registry · governance
        </div>
        <div className="rec">
          <b>Record</b> incumbent EMR – resilient system of record
        </div>
        <div className="d-down">▼</div>
        <div className="learn">
          <b>Learning</b> OMOP · research · AI · federation · analytics
        </div>
      </div>
    ),
    notes: 'Keep implementation names off this slide. Record = must keep working; innovation = evolves fast; control = stops chaos; learning = value at scale.',
  },
  {
    title: 'Demo',
    body: (
      <div className="d-demo">
        <a className="btn-primary big" href="#/demo">
          ▶ Open the live demo
        </a>
        <p>Open patient · new evidence · plugin wakes · agent works · clinician confirms · write-back · change context · kill the platform</p>
      </div>
    ),
    notes: 'Let the demo carry this section. End on the kill switch, then the Drasi reveal.',
  },
  {
    title: 'What is a clinical plugin?',
    body: (
      <div className="d-plugin">
        <pre className="manifest small">{PLUGINS['oncology-staging'].manifest}</pre>
        <div className="d-formula">
          <strong>Plugin =</strong>
          {['data', 'workflow', 'UI', 'agent', 'activation', 'integration', 'operational contract'].map((x, i) => (
            <span key={x}>
              {i > 0 ? '+ ' : '\u00a0\u00a0'}
              {x}
            </span>
          ))}
        </div>
      </div>
    ),
    notes: 'The manifest makes it tangible. Mention: agent loop is the GitHub Copilot SDK; UI is generative but whitelisted per manifest.',
  },
  {
    title: (
      <>
        From data exhaust to a <span className="grad">learning health system.</span>
      </>
    ),
    body: (
      <div className="d-loop">
        <span>Extensible clinical environment</span>
        <i>↓</i>
        <span>better information capture</span>
        <i>↓</i>
        <span>better clinical data</span>
        <div className="d-split">
          <span>Type 1 · clinical agents</span>
          <span>Type 2 · research / AI</span>
        </div>
        <i>↓</i>
        <span className="hl">validated innovation</span>
        <em>↺ back into workflow</em>
      </div>
    ),
    notes: 'Close the loop: the federated data platform hasn’t disappeared – it moved downstream into a larger system.',
  },
];

export function Deck() {
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(SLIDES.length - 1, x + d))), []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault();
        go(1);
      }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) go(-1);
      if (e.key === 'n') setNotes((n) => !n);
      if (e.key === 'f') ref.current?.requestFullscreen?.();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [go]);

  const s = SLIDES[i];
  return (
    <main className="page deck" ref={ref}>
      <div className="slide" key={i} data-testid="slide">
        <span className="slide-n">
          {i + 1} / {SLIDES.length}
        </span>
        <h1>{s.title}</h1>
        <div className="slide-body">{s.body}</div>
      </div>
      {notes && <div className="notes">🗒 {s.notes}</div>}
      <div className="deck-nav">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="Previous slide">
          ←
        </button>
        {SLIDES.map((_, k) => (
          <button key={k} type="button" className={`dot ${k === i ? 'on' : ''}`} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} />
        ))}
        <button type="button" onClick={() => go(1)} disabled={i === SLIDES.length - 1} aria-label="Next slide">
          →
        </button>
        <button type="button" onClick={() => setNotes(!notes)} className="deck-tool">
          notes (n)
        </button>
        <button type="button" onClick={() => ref.current?.requestFullscreen?.()} className="deck-tool">
          fullscreen (f)
        </button>
      </div>
    </main>
  );
}
