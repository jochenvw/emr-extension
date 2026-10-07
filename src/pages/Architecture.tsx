import { useEffect, useState } from 'react';

type PlaneId = 'experience' | 'innovation' | 'control' | 'record' | 'learning';

const PLANES: {
  id: PlaneId;
  name: string;
  tagline: string;
  chips: string[];
  role: string;
  demo: string;
  down: string;
}[] = [
  {
    id: 'experience',
    name: 'Experience plane',
    tagline: 'One clinical surface – contextual capabilities',
    chips: ['Extension surface', 'EMR-embedded launch', 'Generative UI renderer', 'Block registry'],
    role: 'Where the clinician meets capabilities – only those relevant to the current context. Agents don’t ship HTML: they emit typed blocks; the surface owns how they look and behave.',
    demo: 'The dark panel on the right of the demo. It stays quiet until a query says a plugin is relevant.',
    down: 'Disappears. The clinician falls back to the EMR they already know.',
  },
  {
    id: 'innovation',
    name: 'Innovation plane',
    tagline: 'Agents + UI + data + workflow',
    chips: ['Oncology staging', 'Medication safety', 'Trial matching', 'Genomics', 'Pathology', 'Agent loop: GitHub Copilot SDK'],
    role: 'What should evolve quickly. Each plugin bundles data model, workflow, UI blocks, an agent skill and an activation rule. The agent loop runs on the GitHub Copilot SDK – one session per invocation, tools scoped to one patient.',
    demo: 'Oncology Staging extracts TNM with evidence; a deterministic AJCC table computes the stage. Medication Safety checks cisplatin against renal function.',
    down: 'Plugins stop. Nothing clinical depended on them being up.',
  },
  {
    id: 'control',
    name: 'Control plane',
    tagline: 'What stops rapid innovation from becoming chaos',
    chips: ['Context', 'Drasi', 'Auth', 'Audit', 'Registry', 'Deployment', 'Observability', 'Validation', 'Versioning', 'Governance', 'Block whitelist'],
    role: 'Drasi maintains continuous queries over the EMR change feed; result-set changes trigger reactions. Registry, permissions, audit and manifest-level governance (including which UI blocks an agent may render) answer the “100 little apps” objection.',
    demo: 'The console at the bottom of the demo: activation conditions tick green, diffs fire reactions, agent calls are counted – and LLM polling stays at zero.',
    down: 'Change events buffer on the feed and are replayed on restore. Nothing is lost.',
  },
  {
    id: 'record',
    name: 'Record plane',
    tagline: 'Epic / HiX / incumbent EMR – resilient system of record',
    chips: ['Epic', 'HiX', 'FHIR R4 API', 'Change feed', 'Problem list', 'Orders'],
    role: 'What must continue working. The EMR stays authoritative and receives the clinically essential subset of every confirmed result.',
    demo: 'The left-hand EMR. After confirmation it gains a staged problem-list entry and a biomarker order – which survive the platform kill.',
    down: 'Never depends on the extension platform.',
  },
  {
    id: 'learning',
    name: 'Learning / data plane',
    tagline: 'OMOP · research · AI · federation · analytics',
    chips: ['OMOP CDM', 'Research', 'Type 1 clinical agents', 'Type 2 research / AI', 'Federation', 'Analytics'],
    role: 'Where accumulated, structured information becomes useful at scale. The original federated data platform lives here – now fed by better capture upstream.',
    demo: 'Each confirmed staging record produces 6 OMOP rows; a continuous query watches the extension store and queues the export.',
    down: 'Catches up from the extension store later.',
  },
];

const TRACE: { plane: PlaneId; text: string }[] = [
  { plane: 'record', text: 'Pathologist signs biopsy report → FHIR change event on the feed' },
  { plane: 'control', text: 'Drasi: oncology-staging.activate gains a row (context + evidence satisfied)' },
  { plane: 'control', text: 'Registry & governance: load oncology-staging@2.3, check permissions, audit' },
  { plane: 'innovation', text: 'GitHub Copilot SDK agent loop – scoped tools read pathology & imaging' },
  { plane: 'innovation', text: 'Deterministic AJCC 8 tool computes the stage from extracted T, N, M' },
  { plane: 'experience', text: 'render_ui: agent composes approved blocks → generative UI on the surface' },
  { plane: 'experience', text: 'Clinician reviews evidence, edits N1 → N2, confirms' },
  { plane: 'innovation', text: 'Extension store: TumourStaging – 23 fields with evidence & provenance' },
  { plane: 'record', text: 'Minimal write-back: Condition (stage summary) + ServiceRequest (biomarkers)' },
  { plane: 'learning', text: 'Continuous query on the extension store queues 6 OMOP rows' },
];

const OFFLINE: PlaneId[] = ['experience', 'innovation', 'control'];

export function Architecture() {
  const [sel, setSel] = useState<PlaneId>('control');
  const [t, setT] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [killed, setKilled] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (t >= TRACE.length - 1) {
      setPlaying(false);
      return;
    }
    const h = window.setTimeout(() => {
      setT(t + 1);
      setSel(TRACE[t + 1].plane);
    }, t < 0 ? 200 : 1500);
    return () => window.clearTimeout(h);
  }, [playing, t]);

  const active = t >= 0 ? TRACE[t].plane : null;
  const plane = PLANES.find((p) => p.id === sel)!;

  return (
    <main className="page arch">
      <header className="page-head">
        <p className="eyebrow">Make the clinical environment extensible</p>
        <h1>Four planes – and a learning plane underneath</h1>
        <p className="sub">Click a plane. Trace the demo through it. Then pull the plug.</p>
        <div className="arch-controls">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setKilled(false);
              setT(-1);
              setPlaying(true);
            }}
          >
            ▶ Trace the demo
          </button>
          <button type="button" className={`btn-ghost ${killed ? 'danger' : ''}`} onClick={() => setKilled(!killed)} data-testid="arch-kill">
            {killed ? '↻ Restore extension platform' : '⏻ Kill extension platform'}
          </button>
        </div>
      </header>

      <div className="arch-grid">
        <div className="planes">
          {PLANES.map((p) => {
            const off = killed && OFFLINE.includes(p.id);
            return (
              <div key={p.id}>
                {p.id === 'learning' && <div className="plane-arrow">▼</div>}
                <button
                  type="button"
                  className={`plane plane-${p.id} ${sel === p.id ? 'sel' : ''} ${active === p.id ? 'pulse' : ''} ${off ? 'off' : ''}`}
                  onClick={() => setSel(p.id)}
                >
                  <div className="plane-top">
                    <strong>{p.name}</strong>
                    <span>{off ? 'OFFLINE' : p.tagline}</span>
                  </div>
                  <div className="plane-chips">
                    {p.chips.map((c) => (
                      <span key={c} className={/copilot|drasi|generative|whitelist/i.test(c) ? 'key' : ''}>
                        {c}
                      </span>
                    ))}
                  </div>
                  {killed && p.id === 'record' && <span className="plane-still">✓ still working – confirmed stage + biomarker order present</span>}
                </button>
              </div>
            );
          })}
        </div>

        <aside className="arch-side">
          <div className="arch-detail">
            <small className={`plane-dot dot-${plane.id}`}>{plane.name}</small>
            <h3>{plane.tagline}</h3>
            <p>{plane.role}</p>
            <h4>In the demo</h4>
            <p>{plane.demo}</p>
            <h4>If the extension platform fails</h4>
            <p>{plane.down}</p>
          </div>
          <ol className="arch-trace">
            {TRACE.map((x, i) => (
              <li key={i} className={`${i === t ? 'on' : ''} ${i < t ? 'done' : ''}`} onClick={() => { setPlaying(false); setT(i); setSel(x.plane); }}>
                <span className={`plane-dot dot-${x.plane}`} />
                {x.text}
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section className="section agent-explainer">
        <h2>Inside the innovation plane: an agent loop that composes UI</h2>
        <div className="flow">
          {[
            ['Drasi reaction', 'Activation row appears → invoke plugin once'],
            ['Copilot SDK session', 'Plugin system prompt + skill · tools scoped to one patient snapshot'],
            ['Tool calls', 'read_report · get_labs · ajcc_lung_stage · cockcroft_gault · search_trials'],
            ['render_ui (terminal tool)', 'Typed blocks – type enum restricted to the manifest’s ui.blocks'],
            ['Governance gate', 'Drop non-approved blocks · validate required block · fall back if needed'],
            ['Block registry', 'Surface renders interactive, clinician-editable components'],
          ].map(([h, d], i) => (
            <div key={h} className="flow-step">
              <span className="flow-n">{i + 1}</span>
              <strong>{h}</strong>
              <small>{d}</small>
            </div>
          ))}
        </div>
        <p className="sub center">Generative UI as a governed contract: the model chooses <em>what</em> to show; the platform decides <em>how</em> and <em>whether</em>.</p>
      </section>
    </main>
  );
}
