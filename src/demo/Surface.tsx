import { useEffect, useState, useSyncExternalStore } from 'react';
import { ALLOWED_BLOCKS } from '../agent/blocks';
import { ensureRun, getRun, subscribeRun } from '../agent/runs';
import { useDemo } from '../context';
import { PLUGINS, PLUGIN_ORDER } from '../engine/plugins';
import { pluginQuery } from '../engine/queries';
import { lungStage, tnmString } from '../engine/staging';
import { visiblePlugins } from '../engine/store';
import type { PluginSession } from '../engine/types';
import { GenBlockView } from './genui/Blocks';

export function Surface() {
  const { state: s, backend, agentMode } = useDemo();
  const pid = s.context.patientId;
  const visible = visiblePlugins(s).sort((a, b) => PLUGIN_ORDER.indexOf(a.plugin) - PLUGIN_ORDER.indexOf(b.plugin));
  const live = agentMode === 'live' && backend.available;

  return (
    <div className={`surface ${s.platformUp ? '' : 'down'}`} data-testid="surface">
      <header className="surface-head">
        <div>
          <span className="plane-tag plane-exp">Experience plane</span>
          <h2>Clinical Extension Surface</h2>
        </div>
        <div className="surface-meta">
          <span className={`agent-chip ${live ? 'live' : ''}`} title={live ? `GitHub Copilot SDK · ${backend.model ?? 'default model'}` : 'Deterministic agent (no backend)'}>
            {live ? '◆ Copilot SDK' : '◇ scripted agent'}
          </span>
          <span className={`run-chip ${s.platformUp ? 'up' : 'off'}`}>{s.platformUp ? '● runtime online' : '○ runtime offline'}</span>
        </div>
      </header>
      <div className="surface-body">
        {!s.platformUp ? (
          <Offline />
        ) : !pid ? (
          <Quiet title="No patient in context" text="The surface listens to clinical context. Open a chart in the EMR." />
        ) : visible.length === 0 ? (
          <Quiet title="Nothing relevant right now" text="No plugin's activation conditions are satisfied – so nothing is shown, and no agent is running." />
        ) : (
          visible.map((sess) => <PluginFrame key={`${sess.plugin}:${sess.patientId}:${sess.invokedAt}`} sess={sess} />)
        )}
        {s.platformUp && pid && <Installed />}
      </div>
    </div>
  );
}

function Quiet({ title, text }: { title: string; text: string }) {
  return (
    <div className="quiet" data-testid="surface-quiet">
      <div className="quiet-pulse" />
      <h3>{title}</h3>
      <p>{text}</p>
      <p className="quiet-stat">
        <strong>0</strong> LLM calls while waiting
      </p>
    </div>
  );
}

function Offline() {
  const { state: s, dispatch } = useDemo();
  return (
    <div className="offline" data-testid="surface-offline">
      <div className="offline-icon">⏻</div>
      <h3>Extension platform offline</h3>
      <p>Plugins, agents and the control plane are down. The EMR on the left keeps working – confirmed results already live there.</p>
      <p className="quiet-stat">
        <strong>{s.counters.buffered}</strong> change event{s.counters.buffered === 1 ? '' : 's'} buffered on the change feed
      </p>
      <button type="button" className="btn-ghost" onClick={() => dispatch({ type: 'platform.restore' })}>
        ↻ Restore platform & replay
      </button>
    </div>
  );
}

/** Registry of installed plugins with their activation state for the patient in context. */
function Installed() {
  const { state: s } = useDemo();
  const pid = s.context.patientId!;
  return (
    <div className="installed">
      <h4>Installed plugins · activation for this context</h4>
      {PLUGIN_ORDER.map((id) => {
        const meta = PLUGINS[id];
        const conds = pluginQuery(id).conditions!(s, pid);
        const ok = conds.filter((c) => c.ok).length;
        const sess = s.sessions[`${id}:${pid}`];
        return (
          <div key={id} className="installed-row" title={conds.map((c) => `${c.ok ? '✓' : '·'} ${c.label}`).join('\n')}>
            <span className="installed-icon">{meta.icon}</span>
            <span className="installed-name">
              {meta.name} <small>v{meta.version}</small>
            </span>
            <span className="cond-dots">
              {conds.map((c, i) => (
                <i key={i} className={c.ok ? 'ok' : ''} />
              ))}
            </span>
            <span className="installed-state">
              {sess?.status === 'confirmed' ? 'done' : ok === conds.length ? 'active' : `${ok}/${conds.length}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PluginFrame({ sess }: { sess: PluginSession }) {
  const { state: s, dispatch } = useDemo();
  const meta = PLUGINS[sess.plugin];
  const conds = pluginQuery(sess.plugin).conditions!(s, sess.patientId);
  const o = sess.outcome;
  const allowed = ALLOWED_BLOCKS[sess.plugin];

  return (
    <section className={`plugin ${sess.status}`} style={{ ['--hue' as string]: meta.hue }} data-testid={`plugin-${sess.plugin}`}>
      <header className="plugin-head">
        <span className="plugin-icon">{meta.icon}</span>
        <div className="plugin-title">
          <h3>{meta.name}</h3>
          <small>
            v{meta.version} · {meta.owner} · <span className={`status-${meta.status.toLowerCase()}`}>{meta.status}</span>
          </small>
        </div>
        <span className={`plugin-state st-${sess.status}`}>
          {sess.status === 'running' ? 'agent working' : sess.status === 'review' ? 'needs review' : `confirmed ${sess.confirmedAt}`}
        </span>
      </header>

      <div className="why">
        <span className="why-label">Why now</span>
        {conds.map((c) => (
          <span key={c.label} className={`why-chip ${c.ok ? 'ok' : ''}`}>
            {c.ok ? '✓' : '·'} {c.label}
          </span>
        ))}
      </div>

      <AgentLoop sess={sess} />

      {o && (
        <>
          <div className="genui-head">
            <span>
              <b>Generative UI</b> · composed by the agent from {allowed.length} approved block types
            </span>
            <span className="genui-allowed">
              {allowed.map((b) => (
                <code key={b} className={o.blocks.some((x) => x.type === b) ? 'used' : ''}>
                  {b}
                </code>
              ))}
            </span>
          </div>
          {o.note && <div className="gov-note">🛡 {o.note}</div>}
          <div className="genui">
            {o.blocks.map((b, i) => (
              <GenBlockView key={`${b.type}-${i}`} block={b} sess={sess} index={i} />
            ))}
          </div>
          {sess.status === 'review' && <Actions sess={sess} />}
          {sess.status === 'confirmed' && <Writeback sess={sess} />}
        </>
      )}
      {sess.status === 'confirmed' && <div className="plugin-foot">Work complete – this plugin will unload when you leave the chart.</div>}
      {sess.status !== 'confirmed' && sess.status !== 'running' && (
        <button type="button" className="link-btn" onClick={() => dispatch({ type: 'emr.view', view: 'results' })}>
          Open sources in EMR ↗
        </button>
      )}
    </section>
  );
}

function AgentLoop({ sess }: { sess: PluginSession }) {
  const { state, dispatch, agentMode, backend } = useDemo();
  const running = sess.status === 'running';

  useEffect(() => {
    if (running) ensureRun(sess, state, dispatch, agentMode, backend.available);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sess.invokedAt]);

  const run = useSyncExternalStore(
    subscribeRun,
    () => getRun(sess)?.trace,
  );
  const [open, setOpen] = useState(false);
  const o = sess.outcome;
  const trace = o ? o.trace : (run ?? []);
  const isLive = o ? o.mode === 'copilot' : !!getRun(sess)?.live;

  if (!running && !open && o) {
    return (
      <button type="button" className="loop-summary" onClick={() => setOpen(true)}>
        <span className={`loop-mode ${isLive ? 'live' : ''}`}>{isLive ? `◆ Copilot SDK${o.model ? ` · ${o.model}` : ''}` : '◇ scripted agent'}</span>
        <span>
          {trace.length} tool calls → <code>render_ui</code> · {(o.ms / 1000).toFixed(1)} s
        </span>
        <span className="loop-headline">{o.headline}</span>
        <span className="loop-more">trace ▾</span>
      </button>
    );
  }

  return (
    <div className={`loop ${running ? 'running' : ''}`} data-testid="agent-loop">
      <div className="loop-top">
        <span className={`loop-mode ${isLive ? 'live' : ''}`}>{isLive ? '◆ GitHub Copilot SDK – agent loop' : '◇ Scripted agent loop'}</span>
        {running ? <span className="loop-spin">reasoning · calling tools</span> : <button type="button" className="link-btn" onClick={() => setOpen(false)}>hide ▴</button>}
      </div>
      <ol className="loop-trace">
        {trace.map((t, i) => (
          <li key={i} className={t.tool === 'render_ui' ? 'render' : ''}>
            <code>{t.tool}</code>
            {t.args && <span>{t.args}</span>}
          </li>
        ))}
        {running && <li className="pending">…</li>}
      </ol>
    </div>
  );
}

function Actions({ sess }: { sess: PluginSession }) {
  const { dispatch } = useDemo();
  if (sess.plugin === 'oncology-staging' && sess.staging) {
    const stage = lungStage(sess.staging.draft);
    return (
      <div className="actions">
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'staging.confirm' })} data-testid="confirm-staging">
          ✓ Confirm {tnmString(sess.staging.draft)} · stage {stage}
          {sess.staging.orderBiomarkers ? ' + order biomarkers' : ''}
        </button>
        <span className="actions-note">Nothing reaches the EMR until a clinician signs.</span>
      </div>
    );
  }
  if (sess.plugin === 'medication-safety' && sess.med) {
    const ok = !!sess.med.choice && (sess.med.choice !== 'override' || sess.med.reason.trim().length > 3);
    return (
      <div className="actions">
        <button type="button" className="btn-primary" disabled={!ok} onClick={() => dispatch({ type: 'med.confirm' })} data-testid="confirm-med">
          ✓ Record decision
        </button>
        <span className="actions-note">{sess.med.choice === 'override' ? 'Override requires a reason.' : 'Order stays in draft until decided.'}</span>
      </div>
    );
  }
  if (sess.plugin === 'trial-matching') {
    return (
      <div className="actions">
        <button type="button" className="btn-primary" onClick={() => dispatch({ type: 'trial.flag' })} data-testid="confirm-trial">
          ✓ Flag for tumour board
        </button>
        <span className="actions-note">Screening only – eligibility is decided by the study team.</span>
      </div>
    );
  }
  return null;
}

function Writeback({ sess }: { sess: PluginSession }) {
  const { state: s } = useDemo();
  const rec = [...s.extensionStore].reverse().find((r) => r.plugin === sess.plugin && r.patientId === sess.patientId);
  if (!rec) return null;
  const emr =
    sess.plugin === 'oncology-staging'
      ? ['Problem list: NSCLC stage (summary)', ...(sess.staging?.orderBiomarkers ? ['Order: NSCLC biomarker panel'] : [])]
      : sess.plugin === 'medication-safety'
        ? ['MedicationRequest status + review comment']
        : ['Tumour-board task + note'];
  return (
    <div className="writeback" data-testid="writeback">
      <div className="wb-col ext">
        <h5>Extension store</h5>
        <strong>{rec.fields} fields</strong>
        <p>{rec.title}</p>
        <small>evidence · confidence · provenance · edits</small>
      </div>
      <div className="wb-arrow">→</div>
      <div className="wb-col emr">
        <h5>EMR (minimal)</h5>
        <strong>{emr.length} write-back{emr.length > 1 ? 's' : ''}</strong>
        {emr.map((e) => (
          <p key={e}>{e}</p>
        ))}
      </div>
      <div className="wb-arrow">→</div>
      <div className="wb-col learn">
        <h5>Learning plane</h5>
        <strong>{rec.omopRows} OMOP rows</strong>
        <p>queued for research & quality</p>
        <small>{rec.id}</small>
      </div>
    </div>
  );
}
