import type { PluginId } from '../engine/types';

/* Generative UI contract shared with backend/app/genui.py. The agent composes the view from typed
   blocks; each plugin manifest whitelists which block types its agent may use. */

export type Severity = 'info' | 'warning' | 'critical';

export type BlockType = 'summary' | 'stage_proposal' | 'evidence' | 'gap' | 'alert' | 'trend' | 'options' | 'trial_match';

export type GenItem = {
  label: string;
  detail?: string | null;
  value?: string | null;
  refs?: string[] | null;
  confidence?: number | null;
  status?: 'met' | 'unmet' | 'unknown' | null;
  severity?: Severity | null;
};

export type GenBlock = {
  type: BlockType;
  title: string;
  body?: string | null;
  severity?: Severity | null;
  items: GenItem[];
};

export type TraceStep = { tool: string; args?: string };

export type AgentOutcome = {
  mode: 'copilot' | 'scripted';
  model?: string;
  headline: string;
  blocks: GenBlock[];
  trace: TraceStep[];
  note?: string;
  ms: number;
};

export const BLOCK_DOCS: Record<BlockType, string> = {
  summary: 'Short narrative',
  stage_proposal: 'Editable TNM proposal (T/N/M items)',
  evidence: 'Quoted statements linked to EMR sources',
  gap: 'Missing information + proposed order',
  alert: 'Something needing attention',
  trend: 'Values over time (sparkline)',
  options: 'Decision options the clinician picks from',
  trial_match: 'Eligibility criteria: met / unmet / unknown',
};

/** Manifest `ui.blocks`: what each plugin's agent is allowed to render. */
export const ALLOWED_BLOCKS: Record<PluginId, BlockType[]> = {
  'oncology-staging': ['summary', 'stage_proposal', 'evidence', 'gap', 'alert'],
  'medication-safety': ['summary', 'alert', 'trend', 'options', 'evidence'],
  'trial-matching': ['summary', 'trial_match', 'gap', 'evidence'],
};

/** Block each plugin's clinician-in-the-loop interaction depends on. */
export const REQUIRED_BLOCKS: Record<PluginId, BlockType> = {
  'oncology-staging': 'stage_proposal',
  'medication-safety': 'options',
  'trial-matching': 'trial_match',
};
