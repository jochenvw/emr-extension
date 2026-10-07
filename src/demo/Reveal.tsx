import { useDemo } from '../context';

const CONCEPTS = [
  ['Resilient record', 'The EMR stays the system of record and keeps working alone.'],
  ['Contextual activation', 'Capabilities appear only when context + evidence make them relevant.'],
  ['Reactive control plane', 'Drasi maintains activation conditions over the change feed – no polling.'],
  ['Scoped agent loop', 'GitHub Copilot SDK runs one plugin agent, with tools scoped to one patient.'],
  ['Generative UI, governed', 'The agent composes the view from block types the manifest approves.'],
  ['Clinician in the loop', 'Proposals become data only after review, edit and signature.'],
  ['Minimal write-back', 'Rich record in the extension; essential subset back to the EMR.'],
  ['Learning plane', 'Captured structure flows to OMOP for research and quality.'],
];

export function Reveal() {
  const { state: s, dispatch } = useDemo();
  if (!s.reveal) return null;
  const c = s.counters;
  return (
    <div className="reveal" role="dialog" aria-modal="true" data-testid="reveal">
      <div className="reveal-card">
        <p className="eyebrow">What you just saw</p>
        <h2>
          It wasn’t an LLM watching the patient.
          <br />
          <span className="grad">Clinical state is reactive.</span>
        </h2>
        <p className="reveal-quote">
          Drasi maintains the conditions under which a capability becomes relevant. Only then do we invoke the plugin and its agent – and only the
          clinician decides what becomes part of the record.
        </p>
        <div className="reveal-stats">
          <div>
            <b>{c.sourceEvents}</b>
            <small>EMR change events</small>
          </div>
          <div>
            <b>{c.queryDiffs}</b>
            <small>query result changes</small>
          </div>
          <div className="hot">
            <b>{c.agentCalls}</b>
            <small>agent invocations</small>
          </div>
          <div>
            <b>0</b>
            <small>LLM polling calls</small>
          </div>
          <div>
            <b>{c.writebacks}</b>
            <small>EMR write-backs</small>
          </div>
        </div>
        <div className="reveal-concepts">
          {CONCEPTS.map(([t, d], i) => (
            <div key={t} className="concept" style={{ animationDelay: `${200 + i * 90}ms` }}>
              <strong>{t}</strong>
              <span>{d}</span>
            </div>
          ))}
        </div>
        <div className="reveal-actions">
          <a className="btn-primary" href="#/architecture">
            See the architecture →
          </a>
          <a className="btn-ghost" href="#/plugins">
            Inspect the plugins
          </a>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              dispatch({ type: 'reveal', open: false });
              dispatch({ type: 'platform.restore' });
            }}
          >
            Restore platform & explore
          </button>
        </div>
      </div>
    </div>
  );
}
