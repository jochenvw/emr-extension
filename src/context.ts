import { createContext, useContext, type Dispatch } from 'react';
import type { AgentMode } from './agent/runs';
import type { BackendStatus } from './agent/client';
import type { Action } from './engine/store';
import type { State } from './engine/types';

export type DemoCtx = {
  state: State;
  dispatch: Dispatch<Action>;
  step: number;
  setStep: (n: number) => void;
  agentMode: AgentMode;
  setAgentMode: (m: AgentMode) => void;
  backend: BackendStatus;
};

export const DemoContext = createContext<DemoCtx | null>(null);

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('DemoContext missing');
  return ctx;
}
