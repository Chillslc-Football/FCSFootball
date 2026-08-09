import type { AppUpdateState } from '@/data/release/types';

export type ReleasePolicySimulation = AppUpdateState | null;

type Listener = () => void;

let simulation: ReleasePolicySimulation = null;
const listeners = new Set<Listener>();

/** Local/dev-only override — never writes to Supabase. */
export function getReleasePolicySimulation(): ReleasePolicySimulation {
  return simulation;
}

export function setReleasePolicySimulation(next: ReleasePolicySimulation): void {
  simulation = next;
  for (const listener of listeners) listener();
}

export function clearReleasePolicySimulation(): void {
  setReleasePolicySimulation(null);
}

export function subscribeReleasePolicySimulation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Apply simulation over a real decision when present.
 * Production builds ignore simulation unless __DEV__.
 */
export function applyReleasePolicySimulation(
  realState: AppUpdateState,
  options?: { allowSimulation?: boolean },
): AppUpdateState {
  const allow = options?.allowSimulation ?? (typeof __DEV__ !== 'undefined' && __DEV__);
  if (!allow) return realState;
  return simulation ?? realState;
}
