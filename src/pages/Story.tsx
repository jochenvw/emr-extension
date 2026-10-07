import { useState } from 'react';

const CHOICES = [
  { icon: '⏳', title: 'Wait for the EMR vendor', cost: 'Roadmap years. One-size-fits-all build. Innovation queued behind release cycles.' },
  { icon: '🧩', title: 'Build a separate application', cost: 'Another login, another silo, another thing to keep alive. Multiply by 100.' },
  { icon: '📝', title: 'Leave it in the notes', cost: 'Free text nobody can query. Agents and researchers can’t use what was never structured.' },
];

const EVOLUTION = [
  { k: 'Downstream', q: 'How do we federate hospital data so agents and researchers can use it?' },
  { k: 'Upstream', q: 'Hospitals often don’t have the information we want to federate.' },
  { k: 'Deeper question', q: 'Why is it so hard for a hospital to extend what its clinical systems capture and do?' },
  { k: 'Platform', q: 'What would an extensible clinical platform look like?' },
];

const TRIAD = [
  { cls: 'rec', t: 'EMR', r: 'the resilient record', d: 'What must keep working – whatever else fails.' },
  { cls: 'inn', t: 'Extension platform', r: 'the innovation surface', d: 'What should evolve quickly – governed, contextual plugins.' },
  { cls: 'learn', t: 'Data platform', r: 'the learning surface', d: 'Where captured information becomes useful at scale.' },
];

export function Story() {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <main className="page story">
      <section className="hero">
        <p className="eyebrow">A hackathon story in one clinical moment</p>
        <h1>
          AI cannot use information
          <br />
          <span className="grad">the hospital never captured.</span>
        </h1>
        <p className="lede">
          A clinician is treating an oncology patient. The hospital would like to capture tumour state, stage, biomarkers, treatment intent – and the
          AI-derived interpretation of all of it. The EMR does not represent it well.
        </p>
        <div className="hero-cta">
          <a className="btn-primary" href="#/demo">
            ▶ Run the 4-minute demo
          </a>
          <a className="btn-ghost" href="#/deck">
            Six slides
          </a>
        </div>
        <div className="bottleneck" aria-label="Upstream bottleneck">
          {['EMR constraints', 'Not captured / trapped in prose', 'Poor data', 'Limited agents + limited research'].map((x, i) => (
            <span key={x} style={{ animationDelay: `${i * 160}ms` }}>
              {x}
            </span>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Today the hospital has three choices.</h2>
        <p className="sub">Pick one.</p>
        <div className="choices">
          {CHOICES.map((c, i) => (
            <button key={c.title} type="button" className={`choice ${picked === i ? 'on' : ''}`} onClick={() => setPicked(i)}>
              <span className="choice-icon">{c.icon}</span>
              <strong>{c.title}</strong>
              <span className="choice-cost">{c.cost}</span>
            </button>
          ))}
        </div>
        <p className={`verdict ${picked !== null ? 'show' : ''}`}>
          {picked !== null ? (
            <>
              All three are bad. <span className="grad">What if the hospital could extend its clinical environment</span> the way modern software platforms
              are extended – with governed, contextual clinical plugins?
            </>
          ) : (
            '\u00a0'
          )}
        </p>
      </section>

      <section className="section">
        <h2>How we got here</h2>
        <ol className="evolution">
          {EVOLUTION.map((e, i) => (
            <li key={e.k} style={{ animationDelay: `${i * 120}ms` }}>
              <span className="evo-k">{e.k}</span>
              <p>{e.q}</p>
            </li>
          ))}
        </ol>
        <p className="sub center">The federated data platform hasn’t disappeared. It has moved downstream into a larger system.</p>
      </section>

      <section className="section">
        <h2>Three surfaces, three jobs</h2>
        <div className="triad">
          {TRIAD.map((t) => (
            <div key={t.t} className={`triad-card ${t.cls}`}>
              <small>{t.t}</small>
              <strong>{t.r}</strong>
              <p>{t.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section closing">
        <h2 className="big">
          Many innovations. <span className="grad">Few platforms.</span>
        </h2>
        <p className="sub">
          Clinical capabilities, reactively activated by state – rather than an EMR turned into a launcher for dozens of disconnected apps.
        </p>
        <a className="btn-primary" href="#/demo">
          See it work →
        </a>
      </section>
    </main>
  );
}
