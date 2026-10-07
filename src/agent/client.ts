import { M_OPTIONS, N_OPTIONS, T_OPTIONS } from '../engine/staging';
import type { PluginId } from '../engine/types';
import { ALLOWED_BLOCKS, REQUIRED_BLOCKS, type AgentOutcome, type GenBlock, type TraceStep } from './blocks';
import { fallbackBlock } from './fallback';

export type BackendStatus = { available: boolean; copilot?: string; model?: string };

export async function fetchStatus(): Promise<BackendStatus> {
  // Static hosting (GitHub Pages) has no runtime: scripted agents only.
  if (import.meta.env.VITE_STATIC === '1') return { available: false };
  try {
    const r = await fetch('/api/status', { signal: AbortSignal.timeout(2500) });
    if (!r.ok) return { available: false };
    const j = await r.json();
    return { available: true, copilot: j.copilot?.auth_mode, model: j.copilot?.model };
  } catch {
    return { available: false };
  }
}

type StreamEvent =
  | { type: 'tool'; tool: string; args?: string }
  | { type: 'message'; text: string }
  | { type: 'result'; headline: string; blocks: GenBlock[]; model?: string; ms: number }
  | { type: 'error'; message: string };

/** Run the plugin's agent on the backend (GitHub Copilot SDK), streaming tool calls as they happen. */
export async function runLiveAgent(
  plugin: PluginId,
  payload: unknown,
  onTrace: (s: TraceStep) => void,
  signal: AbortSignal,
): Promise<AgentOutcome> {
  const started = performance.now();
  const res = await fetch(`/api/agent/${plugin}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`agent endpoint ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const trace: TraceStep[] = [];
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('');
      if (!data) continue;
      const ev = JSON.parse(data) as StreamEvent;
      if (ev.type === 'tool') {
        const step = { tool: ev.tool, args: ev.args };
        trace.push(step);
        onTrace(step);
      } else if (ev.type === 'error') {
        throw new Error(ev.message);
      } else if (ev.type === 'result') {
        return governBlocks(plugin, {
          mode: 'copilot',
          model: ev.model,
          headline: ev.headline,
          blocks: ev.blocks,
          trace,
          ms: Math.round(performance.now() - started),
        });
      }
    }
  }
  throw new Error('stream ended without result');
}

/**
 * Control-plane check on generated UI: only manifest-approved block types render, and the block the
 * clinician interacts with must be well-formed – otherwise the deterministic block is used.
 */
export function governBlocks(plugin: PluginId, out: AgentOutcome): AgentOutcome {
  const allowed = new Set(ALLOWED_BLOCKS[plugin]);
  const notes: string[] = [];
  let blocks = (out.blocks ?? []).filter((b) => b && allowed.has(b.type));
  const dropped = (out.blocks ?? []).length - blocks.length;
  if (dropped) notes.push(`${dropped} block(s) outside the manifest were blocked`);
  blocks = blocks.map((b) => ({ ...b, items: Array.isArray(b.items) ? b.items : [] }));

  const required = REQUIRED_BLOCKS[plugin];
  const idx = blocks.findIndex((b) => b.type === required);
  if (idx < 0 || !validRequired(plugin, blocks[idx])) {
    const fb = fallbackBlock(plugin, required)!;
    if (idx < 0) blocks = [fb, ...blocks];
    else blocks[idx] = fb;
    notes.push(`${required} replaced by validated deterministic block`);
  }
  return { ...out, blocks, note: [out.note, ...notes].filter(Boolean).join(' · ') || undefined };
}

function validRequired(plugin: PluginId, b: GenBlock): boolean {
  if (plugin === 'oncology-staging') {
    const get = (k: string) => b.items.find((i) => i.label?.trim().toUpperCase().startsWith(k))?.value?.replace(/^c/, '');
    return (
      T_OPTIONS.some((o) => o.v === get('T')) && N_OPTIONS.some((o) => o.v === get('N')) && M_OPTIONS.some((o) => o.v === get('M'))
    );
  }
  if (plugin === 'medication-safety') {
    const vals = new Set(b.items.map((i) => i.value));
    return ['hold', 'board', 'override'].every((v) => vals.has(v));
  }
  return b.items.length > 0;
}
