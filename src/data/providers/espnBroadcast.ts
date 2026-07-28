/**
 * ESPN family networks where the network name itself may open the ESPN game URL.
 * Extend this list when new ESPN family outlets should share that treatment.
 */
const ESPN_OWNED_NETWORKS = [
  'ESPN',
  'ESPN2',
  'ESPN3',
  'ESPNU',
  'ESPN+',
  'ESPN Deportes',
  'ABC',
  'ACC Network',
  'ACCN',
  'SEC Network',
  'SECN',
  'Longhorn Network',
  'LHN',
] as const;

const ESPN_OWNED_NETWORK_KEYS = new Set(
  ESPN_OWNED_NETWORKS.map((name) => normalizeBroadcastNetworkKey(name)),
);

/** Normalize a network label for set membership checks. */
export function normalizeBroadcastNetworkKey(network: string): string {
  const trimmed = network.trim().toUpperCase();
  if (!trimmed) return '';

  // Treat common ESPN+ spellings as the same network.
  const compact = trimmed.replace(/\s+/g, '');
  if (compact === 'ESPNPLUS' || compact === 'ESPN+') return 'ESPN+';

  return compact;
}

/**
 * Primary (first) broadcast network from an ESPN broadcast string.
 * Handles multi-network values joined with " / ".
 */
export function getPrimaryBroadcastNetwork(
  broadcast?: string | null,
): string | undefined {
  if (!broadcast) return undefined;
  const primary = broadcast.split('/')[0]?.trim();
  if (!primary) return undefined;

  // Ignore display placeholders used when ESPN has no network.
  if (primary === '—' || primary === '-' || /^tbd$/i.test(primary) || /^tba$/i.test(primary)) {
    return undefined;
  }

  return primary;
}

/** True when the primary network is an ESPN-owned outlet (incl. ABC). */
export function isEspnOwnedBroadcast(broadcast?: string | null): boolean {
  const primary = getPrimaryBroadcastNetwork(broadcast);
  if (!primary) return false;
  return ESPN_OWNED_NETWORK_KEYS.has(normalizeBroadcastNetworkKey(primary));
}

/** `TV: ESPN+` label, or undefined when no broadcast info. */
export function formatBroadcastTvLabel(broadcast?: string | null): string | undefined {
  const primary = getPrimaryBroadcastNetwork(broadcast);
  if (!primary) return undefined;
  return `TV: ${primary}`;
}

export const ESPN_WATCH_ACTION_LABEL = 'Watch in ESPN';
export const ESPN_GAMECAST_ACTION_LABEL = 'Follow on ESPN GameCast';

/**
 * Action button label for opening the ESPN game URL.
 * ESPN-owned primary networks → Watch in ESPN; otherwise GameCast wording.
 * Missing broadcast also uses GameCast wording.
 */
export function getEspnWatchActionLabel(broadcast?: string | null): string {
  return isEspnOwnedBroadcast(broadcast)
    ? ESPN_WATCH_ACTION_LABEL
    : ESPN_GAMECAST_ACTION_LABEL;
}
