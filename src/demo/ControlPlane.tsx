import { useState } from 'react';
import { useDemo } from '../context';
import { PLUGINS } from '../engine/plugins';
import { QUERIES } from '../engine/queries';
import { clockText } from '../engine/store';

export function ControlPlane() {
  const { state: s, dispatch, backend, agentMode, setAgentMode } = useDemo();
  const [cypher, setCypher] = useState<string | null>(null);
  const pid = s.context.patientId;
  const c = s.counters;

  return (
    <div className={`cp ${s.platformUp ? '' : 'down'}`} data-testid="control-plane">
      <div className="cp-head">
        <span className="plane-tag plane-ctl">Control plane</span>
        <strong>Drasi · continuous queries over the EMR change feed</strong>
        <span className="cp-clock">{clockText(s.clock)}</span>
        <span className="hx-spacer" />
        <div className="cp-counters">
          <Counter label="change events" v={c.sourceEvents} />
          <Counter label="query diffs" v={c.queryDiffs} />
          <Counter label="agent calls" v={c.agentCalls} hot />
          <Counter label="LLM polling" v={0} />
          <Counter label="write-backs" v={c.writebacks} />
          {c.buffered > 0 && <Counter label="buffered" v={c.buffered} warn />}
        </div>
        {backend.available && (
          <div className="mode-toggle" role="group" aria-label="Agent mode">
            <button type="button" className={agentMode === 'live' ? 'on' : ''} onClick={() => setAgentMode('live')} title="Plugin agents run via the GitHub Copilot SDK">
              ◆ Copilot SDK
            </button>
            <button type="button" className={agentMode === 'scripted' ? 'on' : ''} onClick={() => setAgentMode('scripted')} title="Deterministic offline agent">
              ◇ Scripted
            </button>
          </div>
        )}
        <button
          type="button"
          className={`kill ${s.platformUp ? '' : 'restore'}`}
          onClick={() => dispatch({ type: s.platformUp ? 'platform.kill' : 'platform.restore' })}
          data-testid="kill-switch"
        >
          {s.platformUp ? '⏻ Kill platform' : '↻ Restore'}
        </button>
      </div>
      <div className="cp-body">
        <div className="cp-queries">
          {QUERIES.map((q) => {
            const rows = s.results[q.id] ?? [];
            const conds = pid && q.conditions ? q.conditions(s, pid) : null;
            const hit = rows.some((r) => r.patientId === pid);
            const meta = q.plugin ? PLUGINS[q.plugin] : null;
            return (
              <div key={q.id} className={`cq ${hit ? 'hit' : ''}`} style={{ ['--hue' as string]: meta?.hue ?? '#5eead4' }}>
                <div className="cq-head">
                  <span>{meta?.icon ?? '🧬'}</span>
                  <code>{q.id}</code>
                  <span className="cq-rows">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
                  <button type="button" className="link-btn" onClick={() => setCypher(cypher === q.id ? null : q.id)}>
                    {cypher === q.id ? 'hide' : 'cypher'}
                  </button>
                </div>
                {cypher === q.id ? (
                  <pre className="cq-cypher">{q.cypher}</pre>
                ) : conds ? (
                  <ul className="cq-conds">
                    {conds.map((cd) => (
                      <li key={cd.label} className={cd.ok ? 'ok' : ''}>
                        <i>{cd.ok ? '✓' : '○'}</i> {cd.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="cq-conds">
                    {rows.length === 0 ? <li>no confirmed records yet</li> : rows.slice(-3).map((r) => <li key={r.key} className="ok"><i>✓</i> {r.summary}</li>)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <div className="cp-log" aria-live="polite">
          {s.log.slice(0, 40).map((e) => (
            <div key={e.id} className={`log log-${e.kind} ${e.muted ? 'muted' : ''}`}>
              <span className="log-t">{e.t}</span>
              <span className="log-k">{e.sign ?? kindIcon[e.kind]}</span>
              <span className="log-x">{e.text}</span>
            </div>
          ))}
        </div>
      </div>
      {!s.platformUp && <div className="cp-offline">CONTROL PLANE OFFLINE · change feed buffering</div>}
    </div>
  );
}

const kindIcon = { source: '◦', query: '±', reaction: '⚡', agent: '◆', writeback: '↩', system: '·' } as const;

function Counter({ label, v, hot, warn }: { label: string; v: number; hot?: boolean; warn?: boolean }) {
  return (
    <span className={`counter ${hot ? 'hot' : ''} ${warn ? 'warn' : ''}`}>
      <b key={v}>{v}</b>
      <small>{label}</small>
    </span>
  );
}
