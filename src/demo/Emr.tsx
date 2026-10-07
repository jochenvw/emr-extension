import type { ReactNode } from 'react';
import { useDemo } from '../context';
import { CLINICIAN, PATIENT_A, PATIENT_B, worklist } from '../data/patients';
import type { EmrView, MedOrder, Patient } from '../engine/types';

const TODAY = '07.10.2026';

function Pill({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'crit' | 'info'; children: ReactNode }) {
  return <span className={`hx-pill hx-pill-${tone}`}>{children}</span>;
}

function Panel({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="hx-panel">
      <header>
        <h3>{title}</h3>
        {actions && <div className="hx-panel-actions">{actions}</div>}
      </header>
      <div className="hx-panel-body">{children}</div>
    </section>
  );
}

const orderTone = (s: MedOrder['status']) => (s === 'active' ? 'ok' : s === 'draft' ? 'info' : s === 'on-hold' ? 'warn' : 'neutral');

export function Emr() {
  const { state: s, dispatch } = useDemo();
  const p = s.context.patientId ? s.patients[s.context.patientId] : null;
  const newResults = p?.reports.filter((r) => r.isNew).length ?? 0;
  const nav: { id: EmrView; label: string; badge?: number | string }[] = [
    { id: 'worklist', label: 'Clinic worklist', badge: worklist.length },
    { id: 'summary', label: 'Patient summary' },
    { id: 'results', label: 'Results & reports', badge: newResults || undefined },
    { id: 'orders', label: 'Orders' },
    { id: 'notes', label: 'Notes' },
  ];

  return (
    <div className="hx emr" data-testid="emr">
      <div className="hx-appbar">
        <span className="hx-logo">KR</span>
        <strong>Klinikum Rewired München</strong>
        <span className="hx-appbar-sep">|</span>
        <span>Electronic Medical Record</span>
        <span className="hx-spacer" />
        <span>{CLINICIAN} · Medical Oncology</span>
        <span className="hx-appbar-sep">|</span>
        <span>{TODAY}</span>
      </div>
      <div className="hx-menubar" aria-hidden>
        {['File', 'Patient', 'Orders', 'Documents', 'View', 'Tools', 'Help'].map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      {p && <Banner p={p} workflow={s.context.workflow} />}
      <div className="hx-body">
        <nav className="hx-nav" aria-label="EMR">
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!p && item.id !== 'worklist'}
              className={item.id === s.emrView ? 'active' : undefined}
              onClick={() => dispatch({ type: 'emr.view', view: item.id })}
            >
              <span>{item.label}</span>
              {item.badge !== undefined && <span className="hx-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <main className="hx-main">
          {p && s.emrView !== 'worklist' && <Toolbar p={p} />}
          <div className="hx-content">
            {s.notice && <div className="hx-notice">{s.notice}</div>}
            {s.emrView === 'worklist' && <Worklist />}
            {p && s.emrView === 'summary' && <Summary p={p} />}
            {p && s.emrView === 'results' && <Results p={p} />}
            {p && s.emrView === 'orders' && <Orders p={p} />}
            {p && s.emrView === 'notes' && <Notes p={p} />}
          </div>
        </main>
      </div>
      <div className="hx-statusbar">
        <span className="emr-ok">● EMR connected</span>
        <span>Record plane</span>
        <span className={s.platformUp ? 'emr-ext-on' : 'emr-ext-off'}>
          Extension runtime: {s.platformUp ? '● online' : '○ offline – EMR unaffected'}
        </span>
        <span className="hx-spacer" />
        <span>Synthetic data only</span>
      </div>
    </div>
  );
}

function Banner({ p, workflow }: { p: Patient; workflow: string | null }) {
  const [first, ...rest] = p.name.split(' ');
  return (
    <div className="hx-banner">
      <strong className="hx-banner-name">
        {rest.join(' ').toUpperCase()}, {first}
      </strong>
      <span>
        {p.sex} {p.age} y · *{p.born}
      </span>
      <span>MRN {p.mrn}</span>
      <span>{p.ward}</span>
      <span className="hx-banner-dx">{p.headline}</span>
      <span className="hx-allergy">Allergies: {p.allergies}</span>
      {workflow === 'oncology-review' && <span className="hx-workflow">◉ Oncology review</span>}
    </div>
  );
}

function Toolbar({ p }: { p: Patient }) {
  const { state: s, dispatch } = useDemo();
  const pathPending = p.reports.some((r) => r.status === 'pending');
  const bioPending = p.meds.some((m) => m.id === 'OR-BIO-1' && m.status === 'pending');
  return (
    <div className="hx-toolbar">
      <label>
        Workflow
        <select
          value={s.context.workflow ?? 'chart'}
          onChange={(e) => dispatch({ type: 'emr.startWorkflow', workflow: e.target.value as 'chart' | 'oncology-review' })}
          data-testid="workflow-select"
        >
          <option value="chart">Chart review</option>
          <option value="oncology-review">Oncology review</option>
        </select>
      </label>
      {p.id === PATIENT_A && s.context.workflow !== 'oncology-review' && (
        <button type="button" className="hx-btn" onClick={() => dispatch({ type: 'emr.startWorkflow', workflow: 'oncology-review' })}>
          ▶ Start oncology review
        </button>
      )}
      {p.id === PATIENT_B && !p.meds.some((m) => m.nephrotoxic) && (
        <button type="button" className="hx-btn" onClick={() => dispatch({ type: 'emr.draftCisplatin' })}>
          + New order: Cisplatin (H&amp;N chemoradiation protocol)
        </button>
      )}
      <span className="hx-spacer" />
      {pathPending && (
        <button type="button" className="hx-sim" onClick={() => dispatch({ type: 'emr.finalizePathology' })} title="Demo control">
          ⚡ Simulate: pathologist signs biopsy report
        </button>
      )}
      {bioPending && (
        <button type="button" className="hx-sim" onClick={() => dispatch({ type: 'emr.resultBiomarkers' })} title="Demo control">
          ⚡ Simulate: biomarker results arrive
        </button>
      )}
    </div>
  );
}

function Worklist() {
  const { dispatch } = useDemo();
  return (
    <Panel title={`Thoracic & H&N oncology clinic – ${TODAY}`} actions={<Pill tone="info">{worklist.length} appointments</Pill>}>
      <table className="hx-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Patient</th>
            <th>Reason</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {worklist.map((w) => {
            const demo = w.id === PATIENT_A || w.id === PATIENT_B;
            return (
              <tr key={w.id} className={`clickable ${demo ? 'demo-row' : ''}`} onClick={() => dispatch({ type: 'emr.openPatient', id: w.id })}>
                <td>{w.time}</td>
                <td>
                  <strong>{w.name}</strong>
                </td>
                <td>{w.dx}</td>
                <td>
                  <Pill tone={w.status === 'Waiting' ? 'warn' : w.status === 'Seen' ? 'ok' : 'neutral'}>{w.status}</Pill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function SourceTag({ source }: { source?: string }) {
  if (!source) return null;
  return <span className="hx-ext-tag">⚡ via {source}</span>;
}

function Summary({ p }: { p: Patient }) {
  const flagged = p.labs.filter((l) => l.flag);
  return (
    <div className="hx-grid">
      <Panel title="Problem list" actions={<Pill>{p.problems.length}</Pill>}>
        <table className="hx-table" data-testid="problem-list">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {p.problems.map((x) => (
              <tr key={x.id} className={x.isNew ? 'hx-new' : undefined}>
                <td>
                  {x.isNew && <span className="hx-newbadge">NEW</span>} {x.text}
                  <div>
                    <SourceTag source={x.source} />
                  </div>
                </td>
                <td>{x.since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Orders & medication">
        <table className="hx-table">
          <tbody>
            {p.meds.map((m) => (
              <tr key={m.id} className={m.isNew ? 'hx-new' : undefined}>
                <td>
                  {m.isNew && <span className="hx-newbadge">NEW</span>} <strong>{m.drug}</strong> {m.dose}
                </td>
                <td>
                  <Pill tone={orderTone(m.status)}>{m.status}</Pill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title="Flagged results">
        {flagged.length === 0 ? (
          <p className="hx-empty">No flagged results.</p>
        ) : (
          <table className="hx-table">
            <tbody>
              {flagged.map((l) => (
                <tr key={l.id} className="warn">
                  <td>{l.label}</td>
                  <td>
                    <strong>{l.value}</strong> {l.unit} <Pill tone="warn">{l.flag}</Pill>
                  </td>
                  <td>{l.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Results({ p }: { p: Patient }) {
  const { state: s, dispatch } = useDemo();
  const report = p.reports.find((r) => r.id === s.emrReport) ?? p.reports[0];
  return (
    <div className="emr-results">
      <div className="emr-results-left">
        <Panel title="Reports">
          <table className="hx-table">
            <tbody>
              {p.reports.map((r) => (
                <tr
                  key={r.id}
                  className={`clickable ${r.id === report?.id ? 'selected' : ''}`}
                  onClick={() => dispatch({ type: 'emr.showReport', id: r.id })}
                >
                  <td>{r.date}</td>
                  <td>
                    {r.isNew && <span className="hx-newbadge">NEW</span>} {r.title}
                  </td>
                  <td>{r.status === 'final' ? <Pill tone="ok">final</Pill> : <Pill tone="warn">in progress</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="Laboratory">
          <table className="hx-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Value</th>
                <th>Ref</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {p.labs.map((l) => (
                <tr key={l.id} className={l.flag ? 'warn' : undefined}>
                  <td>{l.label}</td>
                  <td>
                    <strong>{l.value}</strong> {l.unit} {l.flag && <Pill tone="warn">{l.flag}</Pill>}
                  </td>
                  <td>{l.ref}</td>
                  <td>{l.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      {report && (
        <Panel title={report.title} actions={<span className="emr-meta">{report.id}</span>}>
          <div className="emr-report" data-testid="report-viewer">
            <p className="emr-meta">
              {report.author} · {report.date} · {report.status === 'final' ? 'signed' : 'not yet signed'}
            </p>
            {report.status === 'pending' ? (
              <div className="emr-pending">
                <p>
                  <strong>Report in progress.</strong> The pathologist has not signed this report yet.
                </p>
                <button type="button" className="hx-sim" onClick={() => dispatch({ type: 'emr.finalizePathology' })}>
                  ⚡ Simulate: pathologist signs report
                </button>
              </div>
            ) : (
              report.segments.map((g, i) =>
                g.id && g.id === s.highlight ? (
                  <p key={i}>
                    <mark className="hx-mark" data-testid="evidence-mark">
                      {g.text}
                    </mark>
                    <span className="hx-ext-tag">⚡ cited by agent</span>
                  </p>
                ) : (
                  <p key={i}>{g.text}</p>
                ),
              )
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Orders({ p }: { p: Patient }) {
  return (
    <Panel title="Orders">
      <table className="hx-table" data-testid="orders">
        <thead>
          <tr>
            <th>Order</th>
            <th>Dose</th>
            <th>Route</th>
            <th>Schedule</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {p.meds.map((m) => (
            <tr key={m.id} className={`${m.isNew ? 'hx-new' : ''} ${m.status === 'on-hold' ? 'warn' : ''}`}>
              <td>
                {m.isNew && <span className="hx-newbadge">NEW</span>} <strong>{m.drug}</strong>
                {m.comment && <div className="emr-comment">{m.comment}</div>}
              </td>
              <td>{m.dose}</td>
              <td>{m.route}</td>
              <td>{m.schedule}</td>
              <td>
                <Pill tone={orderTone(m.status)}>{m.status}</Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function Notes({ p }: { p: Patient }) {
  return (
    <>
      {p.notes.map((n) => (
        <Panel key={n.id} title={`${n.date} · ${n.title}`} actions={<span className="emr-meta">{n.author}</span>}>
          <p className={n.isNew ? 'hx-new-note' : undefined}>{n.text}</p>
          <SourceTag source={n.source} />
        </Panel>
      ))}
    </>
  );
}
