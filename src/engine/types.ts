import type { AgentOutcome } from '../agent/blocks';

export type Segment = { id?: string; text: string };

export type Report = {
  id: string;
  kind: 'pathology' | 'imaging' | 'molecular';
  title: string;
  date: string;
  author: string;
  status: 'pending' | 'final';
  segments: Segment[];
  isNew?: boolean;
};

export type Lab = {
  id: string;
  label: string;
  value: string;
  unit: string;
  date: string;
  ref?: string;
  flag?: 'H' | 'L';
};

export type MedOrder = {
  id: string;
  drug: string;
  dose: string;
  route: string;
  schedule: string;
  status: 'active' | 'draft' | 'on-hold' | 'pending';
  comment?: string;
  nephrotoxic?: boolean;
  safetyReviewed?: boolean;
  isNew?: boolean;
};

export type Problem = { id: string; text: string; since: string; source?: string; isNew?: boolean };

export type Note = { id: string; date: string; author: string; title: string; text: string; source?: string; isNew?: boolean };

export type Patient = {
  id: string;
  mrn: string;
  name: string;
  sex: 'F' | 'M';
  born: string;
  age: number;
  weightKg: number;
  ward: string;
  allergies: string;
  headline: string;
  problems: Problem[];
  reports: Report[];
  labs: Lab[];
  meds: MedOrder[];
  notes: Note[];
  biomarkersResulted?: boolean;
  trialFlagged?: boolean;
};

export type Workflow = 'chart' | 'oncology-review';
export type EmrView = 'worklist' | 'summary' | 'results' | 'orders' | 'notes';
export type PluginId = 'oncology-staging' | 'medication-safety' | 'trial-matching';

export type TCat = 'T1a' | 'T1b' | 'T1c' | 'T2a' | 'T2b' | 'T3' | 'T4';
export type NCat = 'N0' | 'N1' | 'N2' | 'N3';
export type MCat = 'M0' | 'M1a' | 'M1b' | 'M1c';
export type TNM = { T: TCat; N: NCat; M: MCat };

export type MedChoice = 'hold' | 'board' | 'override';

export type PluginSession = {
  plugin: PluginId;
  patientId: string;
  status: 'running' | 'review' | 'confirmed';
  visit: number;
  invokedAt: string;
  confirmedAt?: string;
  outcome?: AgentOutcome;
  staging?: { proposed: TNM; draft: TNM; orderBiomarkers: boolean };
  med?: { choice: MedChoice | null; reason: string };
};

export type Row = { key: string; patientId: string; summary: string };

export type LogKind = 'source' | 'query' | 'reaction' | 'agent' | 'writeback' | 'system';
export type LogEntry = { id: number; t: string; kind: LogKind; text: string; sign?: '+' | '-'; muted?: boolean };

export type StoreRecord = {
  id: string;
  plugin: PluginId;
  patientId: string;
  at: string;
  title: string;
  fields: number;
  omopRows: number;
};

export type State = {
  clock: number;
  patients: Record<string, Patient>;
  context: { patientId: string | null; workflow: Workflow | null; visit: number };
  emrView: EmrView;
  emrReport: string | null;
  highlight: string | null;
  platformUp: boolean;
  results: Record<string, Row[]>;
  sessions: Record<string, PluginSession>;
  extensionStore: StoreRecord[];
  log: LogEntry[];
  logSeq: number;
  counters: { sourceEvents: number; queryDiffs: number; agentCalls: number; buffered: number; writebacks: number };
  reveal: boolean;
  notice: string | null;
};
