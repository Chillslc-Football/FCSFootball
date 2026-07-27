import {
  ESPN_GAMECAST_ACTION_LABEL,
  ESPN_WATCH_ACTION_LABEL,
  formatBroadcastTvLabel,
  getEspnWatchActionLabel,
  getPrimaryBroadcastNetwork,
  isEspnOwnedBroadcast,
} from '@/data/providers/espnBroadcast';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function run(): void {
  assert(isEspnOwnedBroadcast('ESPN'), 'ESPN should be ESPN-owned');
  assert(isEspnOwnedBroadcast('ESPN2'), 'ESPN2 should be ESPN-owned');
  assert(isEspnOwnedBroadcast('ESPNU'), 'ESPNU should be ESPN-owned');
  assert(isEspnOwnedBroadcast('ESPN+'), 'ESPN+ should be ESPN-owned');
  assert(isEspnOwnedBroadcast('espn plus'), 'espn plus should map to ESPN+');
  assert(isEspnOwnedBroadcast('ABC'), 'ABC should be ESPN-owned');
  assert(isEspnOwnedBroadcast('ESPN3'), 'ESPN3 should be ESPN-owned');

  assert(!isEspnOwnedBroadcast('CBS Sports Network'), 'CBSSN is not ESPN-owned');
  assert(!isEspnOwnedBroadcast('FloSports'), 'FloSports is not ESPN-owned');
  assert(!isEspnOwnedBroadcast('YouTube'), 'YouTube is not ESPN-owned');
  assert(!isEspnOwnedBroadcast('Local TV'), 'Local TV is not ESPN-owned');
  assert(!isEspnOwnedBroadcast(undefined), 'missing broadcast is not ESPN-owned');
  assert(!isEspnOwnedBroadcast(''), 'empty broadcast is not ESPN-owned');

  assert(
    getPrimaryBroadcastNetwork('ESPN+ / Local') === 'ESPN+',
    'primary network should be the first entry',
  );
  assert(
    formatBroadcastTvLabel('ESPN2') === 'TV: ESPN2',
    'TV label should prefix the primary network',
  );
  assert(
    formatBroadcastTvLabel(undefined) === undefined,
    'missing broadcast should hide the TV row',
  );

  assert(
    getEspnWatchActionLabel('ESPN+') === ESPN_WATCH_ACTION_LABEL,
    'ESPN+ should use Watch in ESPN',
  );
  assert(
    getEspnWatchActionLabel('ABC') === ESPN_WATCH_ACTION_LABEL,
    'ABC should use Watch in ESPN',
  );
  assert(
    getEspnWatchActionLabel('CBS Sports Network') === ESPN_GAMECAST_ACTION_LABEL,
    'non-ESPN should use GameCast label',
  );
  assert(
    getEspnWatchActionLabel('FloSports') === ESPN_GAMECAST_ACTION_LABEL,
    'FloSports should use GameCast label',
  );
  assert(
    getEspnWatchActionLabel(undefined) === ESPN_GAMECAST_ACTION_LABEL,
    'missing broadcast should use GameCast label',
  );

  console.log('espn broadcast helper tests passed');
}

run();
