import type { Dispatch } from 'react';
import type { Action } from '../engine/store';
import { agentPayload } from '../engine/store';
import type { PluginSession, State } from '../engine/types';
import type { TraceStep } from './blocks';
import { runLiveAgent } from './client';
import { scriptedOutcome, scriptedTrace } from './fallback';

export type AgentMode = 'live' | 'scripted';

type Run = { trace: TraceStep[]; live: boolean; fellBack?: string };

const listeners = new Set<() => void>();

let epoch = 0;
const runs = new Map<string, Run>();

const runKey = (s: PluginSession) => `${epoch}:${s.plugin}:${s.patientId}:${s.invokedAt}`;

/** Forget in-flight runs (guide reset / jump): their results are discarded. */
export function resetRuns() {
  epoch++;
  runs.clear();
}

export function getRun(s: PluginSession) {
  return runs.get(runKey(s));
}

export function subscribeRun(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Start the agent for a session exactly once. Runs keep going if the panel unmounts. */
export function ensureRun(sess: PluginSession, state: State, dispatch: Dispatch<Action>, mode: AgentMode, liveAvailable: boolean) {
  const key = runKey(sess);
  if (runs.has(key)) return;
  const myEpoch = epoch;
  const run: Run = { trace: [], live: mode === 'live' && liveAvailable };
  runs.set(key, run);
  queueMicrotask(() => listeners.forEach((l) => l()));
  const emit = () => listeners.forEach((l) => l());
  const push = (t: TraceStep) => {
    run.trace = [...run.trace, t];
    emit();
  };
  const finish = (outcome: ReturnType<typeof scriptedOutcome>) => {
    if (epoch !== myEpoch) return;
    dispatch({ type: 'agent.done', plugin: sess.plugin, patientId: sess.patientId, outcome });
  };
  const scripted = (note?: string) => {
    const steps = scriptedTrace(sess.plugin);
    const started = performance.now();
    steps.forEach((t, i) =>
      window.setTimeout(() => {
        if (epoch !== myEpoch) return;
        push(t);
        if (i === steps.length - 1) {
          window.setTimeout(() => finish({ ...scriptedOutcome(sess.plugin, Math.round(performance.now() - started)), note }), 450);
        }
      }, 450 + i * 520),
    );
  };

  if (!run.live) {
    scripted();
    return;
  }
  const ctrl = new AbortController();
  const timeout = window.setTimeout(() => ctrl.abort(), 90_000);
  runLiveAgent(sess.plugin, agentPayload(state, sess.plugin, sess.patientId), push, ctrl.signal)
    .then((o) => finish(o))
    .catch((e: unknown) => {
      if (epoch !== myEpoch) return;
      const why = e instanceof Error ? e.message : String(e);
      run.live = false;
      run.fellBack = why;
      run.trace = [];
      emit();
      scripted(`Copilot SDK unavailable (${why.slice(0, 80)}) – deterministic agent used`);
    })
    .finally(() => window.clearTimeout(timeout));
}
