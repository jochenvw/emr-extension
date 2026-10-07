import { useState } from 'react';
import { BLOCK_DOCS, type BlockType } from '../agent/blocks';
import { PLUGINS, PLUGIN_ORDER, type PluginMeta } from '../engine/plugins';

type Term = 'data' | 'workflow' | 'UI' | 'agent' | 'activation' | 'integration' | 'operational contract';

const TERMS: { t: Term; d: string; match: (section: string, line: string) => boolean }[] = [
  { t: 'data', d: 'What it reads and what new structure it adds', match: (s) => s === 'requires' || s === 'provides' },
  { t: 'workflow', d: 'Which clinical moment it belongs to', match: (s, l) => s === 'activates_when' && /workflow|order:|stage:/.test(l) },
  { t: 'UI', d: 'Approved generative-UI blocks', match: (s) => s === 'ui' },
  { t: 'agent', d: 'Copilot SDK loop, skill and scoped tools', match: (s) => s === 'agent' },
  { t: 'activation', d: 'The continuous query that makes it relevant', match: (s) => s === 'activates_when' },
  { t: 'integration', d: 'Minimal write-back into the EMR', match: (s) => s === 'writeback' },
  { t: 'operational contract', d: 'Owner, version, failure behaviour', match: (s) => ['version', 'owner', 'fallback'].includes(s) },
];

const QA = [
  ['Who approves these?', 'A clinical extension board signs off a version; the registry only loads APPROVED or explicitly piloted plugins.'],
  ['Who owns them?', 'A named clinical owner per plugin (Thoracic Oncology, Clinical Pharmacy) – on the card, in the manifest.'],
  ['What permissions do they get?', 'Declared FHIR scopes. The agent’s tools only see the in-context patient snapshot – nothing else.'],
  ['How are they upgraded?', 'Versioned manifests; validation on the learning plane before promotion; rollback is a registry change.'],
  ['Can one depend on another?', 'Yes – Trial Matching activates on Oncology Staging’s confirmed stage. Dependencies are explicit.'],
  ['What happens when one fails?', 'It disappears. The EMR retains the minimum clinical record; change events buffer and replay.'],
  ['How is it validated?', 'Clinician edits vs. agent proposals are captured per field – a built-in validation dataset.'],
  ['Can the AI draw anything it wants?', 'No. Generative UI is restricted to whitelisted block types; a governance gate drops the rest.'],
];

function Manifest({ text, term }: { text: string; term: Term | null }) {
  const def = TERMS.find((x) => x.t === term);
  let section = '';
  return (
    <pre className="manifest">
      {text.split('\n').map((line, i) => {
        const top = line.match(/^ {2}(\w+):/);
        if (top) section = top[1];
        else if (!line.startsWith('   ') && line.trim()) section = '';
        const on = def && line.trim() && def.match(section, line);
        return (
          <span key={i} className={on ? 'hl' : ''}>
            {line || ' '}
            {'\n'}
          </span>
        );
      })}
    </pre>
  );
}

function Card({ p, flipped, onFlip, term }: { p: PluginMeta; flipped: boolean; onFlip: () => void; term: Term | null }) {
  const rows: [string, string][] = [
    ['Owner', p.owner],
    ['Activates', p.activates],
    ['Reads', p.reads],
    ['Adds', p.adds],
    ['AI', `${p.ai} · Copilot SDK`],
    ['Clinician', p.clinician],
    ['Writes back', p.writesBack],
    ['Degradation', p.degradation],
  ];
  if (p.dependsOn) rows.push(['Depends on', p.dependsOn]);
  return (
    <div className={`pcard ${flipped || term ? 'flipped' : ''}`} style={{ ['--hue' as string]: p.hue }}>
      <div className="pcard-inner">
        <div className="pcard-face front">
          <header>
            <span className="pcard-icon">{p.icon}</span>
            <h3>{p.name.toUpperCase()}</h3>
            <span className="pcard-v">v{p.version}</span>
          </header>
          <dl>
            {rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <footer>
            <span className="pcard-perms">{p.permissions.length} permissions</span>
            <span className={`pcard-status ${p.status.toLowerCase()}`}>{p.status === 'APPROVED' ? '✓ APPROVED' : '◐ PILOT'}</span>
          </footer>
          <button type="button" className="pcard-flip" onClick={onFlip}>
            manifest ⟲
          </button>
        </div>
        <div className="pcard-face back">
          <Manifest text={p.manifest} term={term} />
          <button type="button" className="pcard-flip" onClick={onFlip}>
            card ⟲
          </button>
        </div>
      </div>
    </div>
  );
}

export function Plugins() {
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [term, setTerm] = useState<Term | null>(null);
  const blocks = Object.keys(BLOCK_DOCS) as BlockType[];
  return (
    <main className="page plugins">
      <header className="page-head">
        <p className="eyebrow">What is a clinical plugin?</p>
        <h1>A package a hospital can actually operate</h1>
        <p className="sub">Flip a card to see its manifest. Hover the formula to see where each part lives.</p>
      </header>

      <div className="pcards">
        {PLUGIN_ORDER.map((id) => (
          <Card key={id} p={PLUGINS[id]} flipped={!!flipped[id]} onFlip={() => setFlipped({ ...flipped, [id]: !flipped[id] })} term={term} />
        ))}
      </div>
      <div className="runtime-bar">
        <span className="rt-lines" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <strong>CLINICAL EXTENSION RUNTIME</strong>
        <small>registry · activation (Drasi) · agent loop (GitHub Copilot SDK) · genUI governance · audit · write-back</small>
      </div>

      <section className="section">
        <h2>Plugin =</h2>
        <div className="formula" onMouseLeave={() => setTerm(null)}>
          {TERMS.map((x, i) => (
            <button
              key={x.t}
              type="button"
              className={`term ${term === x.t ? 'on' : ''}`}
              onMouseEnter={() => setTerm(x.t)}
              onFocus={() => setTerm(x.t)}
              onClick={() => setTerm(term === x.t ? null : x.t)}
            >
              <span className="plus">{i > 0 ? '+' : ''}</span>
              <strong>{x.t}</strong>
              <small>{x.d}</small>
            </button>
          ))}
        </div>
        <p className="sub center">Much more memorable than a database schema.</p>
      </section>

      <section className="section">
        <h2>Generative UI – the approved block catalogue</h2>
        <p className="sub">
          The agent never ships markup. It calls <code>render_ui</code> with typed blocks; each manifest whitelists which ones it may use; the surface
          renders them as interactive, clinician-editable components.
        </p>
        <div className="catalog">
          {blocks.map((b) => (
            <div key={b} className="catalog-item">
              <code>{b}</code>
              <span>{BLOCK_DOCS[b]}</span>
              <span className="catalog-users">
                {PLUGIN_ORDER.filter((id) => PLUGINS[id].manifest.includes(b)).map((id) => (
                  <i key={id} title={PLUGINS[id].name} style={{ background: PLUGINS[id].hue }} />
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>The questions this provokes – and that’s the point</h2>
        <p className="sub">From “cool AI demo” to “could a hospital actually operate this?”</p>
        <div className="qa">
          {QA.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
