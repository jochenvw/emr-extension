import type { ComponentType } from 'react';
import type { GenBlock } from '../../agent/blocks';
import { useDemo } from '../../context';
import { lungStage, M_OPTIONS, N_OPTIONS, T_OPTIONS } from '../../engine/staging';
import type { MedChoice, PluginSession, TNM } from '../../engine/types';

/* Generative UI registry: the agent picks block types (within the manifest whitelist);
   these components decide how each is drawn and how the clinician interacts with it. */

type Props = { block: GenBlock; sess: PluginSession };

export function RefChips({ refs }: { refs?: string[] | null }) {
  const { state: s, dispatch } = useDemo();
  const p = s.context.patientId ? s.patients[s.context.patientId] : null;
  if (!refs?.length || !p) return null;
  return (
    <span className="gx-refs">
      {refs.map((id) => {
        const r = p.reports.find((rr) => rr.segments.some((g) => g.id === id));
        if (!r) return null;
        const short = `${r.title.split(/[ –(,]/)[0]} ${r.date.slice(0, 5)}`;
        return (
          <button
            key={id}
            type="button"
            className={`gx-ref ${s.highlight === id ? 'on' : ''}`}
            title={r.segments.find((g) => g.id === id)?.text}
            onClick={() => dispatch({ type: 'emr.evidence', segment: id })}
          >
            ↗ {short}
          </button>
        );
      })}
    </span>
  );
}

function Summary({ block }: Props) {
  return <p className="gx-body">{block.body}</p>;
}

function StageProposal({ block, sess }: Props) {
  const { dispatch } = useDemo();
  const st = sess.staging;
  if (!st) return null;
  const editable = sess.status === 'review';
  const stage = lungStage(st.draft);
  const proposedStage = lungStage(st.proposed);
  const changed = stage !== proposedStage || (['T', 'N', 'M'] as const).some((k) => st.draft[k] !== st.proposed[k]);
  const opts = { T: T_OPTIONS, N: N_OPTIONS, M: M_OPTIONS };
  return (
    <div className="gx-stage">
      <div className="gx-stage-head">
        <div className={`gx-stage-badge ${changed ? 'changed' : ''}`} data-testid="stage-badge">
          <small>Stage</small>
          <strong>{stage}</strong>
          <small>AJCC 8</small>
        </div>
        <div>
          {block.body && <p className="gx-body">{block.body}</p>}
          <p className="gx-tnm">
            c{st.draft.T} c{st.draft.N} c{st.draft.M}
            {changed && (
              <span className="gx-changed">
                modified by clinician · agent proposed <s>{proposedStage}</s>
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="gx-tnm-grid">
        {(['T', 'N', 'M'] as const).map((k) => {
          const item = block.items.find((i) => i.label.trim().toUpperCase().startsWith(k));
          const conf = item?.confidence ?? null;
          return (
            <div key={k} className={`gx-tnm-tile ${item?.severity === 'warning' ? 'warn' : ''} ${st.draft[k] !== st.proposed[k] ? 'edited' : ''}`}>
              <div className="gx-tnm-top">
                <span className="gx-tnm-k">{k}</span>
                {editable ? (
                  <select
                    aria-label={`${k} category`}
                    data-testid={`tnm-${k}`}
                    value={st.draft[k]}
                    onChange={(e) => dispatch({ type: 'staging.edit', key: k as keyof TNM, value: e.target.value })}
                  >
                    {opts[k].map((o) => (
                      <option key={o.v} value={o.v} title={o.d}>
                        c{o.v}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>c{st.draft[k]}</strong>
                )}
              </div>
              {conf !== null && (
                <div className="gx-conf" title={`Agent confidence ${Math.round(conf * 100)}%`}>
                  <span style={{ width: `${Math.round(conf * 100)}%` }} />
                </div>
              )}
              <p>{item?.detail}</p>
              <RefChips refs={item?.refs} />
            </div>
          );
        })}
      </div>
      <p className="gx-foot">Stage grouping by deterministic AJCC 8 rule table – the LLM extracts, the rules compute.</p>
    </div>
  );
}

function Evidence({ block }: Props) {
  return (
    <ul className="gx-list">
      {block.items.map((i, n) => (
        <li key={n}>
          <span>{i.label}</span>
          {i.detail && <small>{i.detail}</small>}
          <RefChips refs={i.refs} />
        </li>
      ))}
    </ul>
  );
}

function Gap({ block, sess }: Props) {
  const { dispatch } = useDemo();
  return (
    <div>
      {block.body && <p className="gx-body">{block.body}</p>}
      {block.items.map((i, n) =>
        i.value === 'order-biomarkers' && sess.staging ? (
          <label key={n} className="gx-check">
            <input
              type="checkbox"
              checked={sess.staging.orderBiomarkers}
              disabled={sess.status !== 'review'}
              onChange={() => dispatch({ type: 'staging.toggleBiomarkers' })}
              data-testid="order-biomarkers"
            />
            <span>{i.label}</span>
            <RefChips refs={i.refs} />
          </label>
        ) : (
          <p key={n} className="gx-body">
            • {i.label} <RefChips refs={i.refs} />
          </p>
        ),
      )}
    </div>
  );
}

function Alert({ block }: Props) {
  return (
    <div>
      {block.body && <p className="gx-body">{block.body}</p>}
      {block.items.length > 0 && <Evidence block={block} sess={undefined as never} />}
    </div>
  );
}

function Trend({ block }: Props) {
  const pts = block.items.map((i) => ({ label: i.label, v: Number(i.value) })).filter((x) => !Number.isNaN(x.v));
  if (pts.length < 2) return <Evidence block={block} sess={undefined as never} />;
  const W = 300;
  const H = 70;
  const max = Math.max(...pts.map((p) => p.v), 90);
  const min = Math.min(...pts.map((p) => p.v), 30);
  const x = (i: number) => 20 + (i * (W - 40)) / (pts.length - 1);
  const y = (v: number) => 8 + ((max - v) * (H - 24)) / (max - min || 1);
  const thr = y(60);
  return (
    <svg className="gx-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={block.title}>
      <line x1="0" x2={W} y1={thr} y2={thr} className="gx-thr" />
      <text x={W - 4} y={thr - 3} textAnchor="end" className="gx-thr-t">
        60
      </text>
      <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.v)} r="3.5" />
          <text x={x(i)} y={y(p.v) - 7} textAnchor="middle" className="gx-v">
            {p.v}
          </text>
          <text x={x(i)} y={H - 2} textAnchor="middle" className="gx-l">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Options({ block, sess }: Props) {
  const { dispatch } = useDemo();
  const med = sess.med;
  if (!med) return null;
  const editable = sess.status === 'review';
  return (
    <div className="gx-options">
      {block.items.map((i) => (
        <label key={i.value} className={`gx-option ${med.choice === i.value ? 'on' : ''}`}>
          <input
            type="radio"
            name={`opt-${sess.patientId}`}
            disabled={!editable}
            checked={med.choice === i.value}
            onChange={() => dispatch({ type: 'med.choose', choice: i.value as MedChoice })}
          />
          <span>
            {i.label}
            {i.detail && <small> · {i.detail}</small>}
          </span>
        </label>
      ))}
      {med.choice === 'override' && editable && (
        <textarea
          placeholder="Reason for override (required)"
          value={med.reason}
          onChange={(e) => dispatch({ type: 'med.reason', reason: e.target.value })}
        />
      )}
    </div>
  );
}

function TrialMatch({ block }: Props) {
  const icon = { met: '✓', unmet: '✕', unknown: '?' } as const;
  return (
    <div>
      {block.body && <p className="gx-body">{block.body}</p>}
      <ul className="gx-criteria">
        {block.items.map((i, n) => (
          <li key={n} className={i.status ?? 'unknown'}>
            <span className="gx-crit-i">{icon[i.status ?? 'unknown']}</span>
            <span>
              {i.label}
              {i.detail && <small>{i.detail}</small>}
            </span>
            <RefChips refs={i.refs} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const REGISTRY: Record<GenBlock['type'], ComponentType<Props>> = {
  summary: Summary,
  stage_proposal: StageProposal,
  evidence: Evidence,
  gap: Gap,
  alert: Alert,
  trend: Trend,
  options: Options,
  trial_match: TrialMatch,
};

export function GenBlockView({ block, sess, index }: Props & { index: number }) {
  const C = REGISTRY[block.type] ?? Summary;
  return (
    <article className={`gx-block gx-${block.type}`} data-severity={block.severity ?? undefined} style={{ animationDelay: `${index * 110}ms` }}>
      <header>
        <span className="gx-kind">{block.type}</span>
        <h4>{block.title}</h4>
      </header>
      <C block={block} sess={sess} />
    </article>
  );
}
