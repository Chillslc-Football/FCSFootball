/**
 * Responsive layout geometry + ESPN transport retry tests.
 * Run: npm.cmd run test:responsive-layout
 */

import assert from 'node:assert/strict';

import {
  EspnFetchError,
  formatEspnFetchError,
  formatScoresLoadError,
  isEspnTransportFailure,
  withEspnTransportRetry,
} from '@/data/providers/espnFetchErrors';
import {
  LAYOUT_COLUMNS,
  POLL_RANK_COLUMN_WIDTH,
  STANDINGS_COLUMN_WIDTHS,
  quickLinkLabelFitsAtWidth,
  quickLinkLabelMaxWidth,
  quickLinkCardWidth,
} from '@/theme/layoutColumns';

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`ok  - ${name}`);
    })
    .catch((error) => {
      console.error(`fail - ${name}`);
      throw error;
    });
}

async function main(): Promise<void> {
  await test('poll rank column wide enough for two-digit ranks', () => {
    assert.equal(POLL_RANK_COLUMN_WIDTH, LAYOUT_COLUMNS.pollRank);
    assert.ok(LAYOUT_COLUMNS.pollRank >= 32, 'rank column must fit 20/22/25');
    for (const rank of [1, 9, 10, 17, 20, 22, 25]) {
      assert.equal(String(rank).includes('\n'), false);
      assert.ok(String(rank).length <= 2);
    }
  });

  await test('poll trailing/points cluster is protected', () => {
    assert.ok(LAYOUT_COLUMNS.pollTrailingMin >= 48);
  });

  await test('conference CONF/OVERALL stay single-token labels', () => {
    assert.equal('CONF'.split(/\s+/).length, 1);
    assert.equal('OVERALL'.split(/\s+/).length, 1);
    assert.ok(STANDINGS_COLUMN_WIDTHS.conf >= 48);
    assert.ok(
      STANDINGS_COLUMN_WIDTHS.overall >= 64,
      'OVERALL needs more width than CONF on Android fonts',
    );
    assert.ok(STANDINGS_COLUMN_WIDTHS.overall > STANDINGS_COLUMN_WIDTHS.conf);
  });

  await test('standings header/data share the same column geometry', () => {
    assert.equal(STANDINGS_COLUMN_WIDTHS.conf, LAYOUT_COLUMNS.standingsConf);
    assert.equal(STANDINGS_COLUMN_WIDTHS.overall, LAYOUT_COLUMNS.standingsOverall);
  });

  await test('compact schedule meta column remains valid', () => {
    assert.equal(LAYOUT_COLUMNS.scheduleMeta, 96);
    assert.ok(LAYOUT_COLUMNS.scoreValue >= 36);
  });

  await test('long poll team names cannot shrink protected columns', () => {
    // Geometry contract: name is flex; rank/trailing are fixed/min widths.
    const protectedMin = LAYOUT_COLUMNS.pollRank + LAYOUT_COLUMNS.pollTrailingMin;
    assert.ok(protectedMin >= 36 + 56);
    assert.ok(LAYOUT_COLUMNS.pollRank + LAYOUT_COLUMNS.pollTrailingMin < 320);
  });

  await test('transport failure then retry success', async () => {
    let attempts = 0;
    const result = await withEspnTransportRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new EspnFetchError('ESPN fetch failed: Network request failed.');
        }
        return 'ok';
      },
      { delayMs: 1, sleep: async () => undefined },
    );
    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });

  await test('two transport failures surface the error', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            attempts += 1;
            throw new EspnFetchError('ESPN fetch failed: Network request failed.');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      (err: unknown) =>
        err instanceof EspnFetchError && err.message.includes('Network request failed'),
    );
    assert.equal(attempts, 2);
  });

  await test('timeouts are not retried', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            attempts += 1;
            throw new EspnFetchError('ESPN fetch timed out after 8 seconds.');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      /timed out/,
    );
    assert.equal(attempts, 1);
  });

  await test('production ESPN error copy contains no Expo Go', () => {
    // Node test runner: __DEV__ is typically undefined → production branch.
    const mapped = formatEspnFetchError(new TypeError('Network request failed'), 8000);
    assert.doesNotMatch(mapped.message, /Expo Go/i);
    assert.match(mapped.message, /connection|try again/i);

    const scoresMessage = formatScoresLoadError(new TypeError('Network request failed'));
    assert.doesNotMatch(scoresMessage, /Expo Go/i);
    assert.match(scoresMessage, /Scores couldn't be loaded/i);
  });

  await test('isEspnTransportFailure detects network errors only', () => {
    assert.equal(
      isEspnTransportFailure(
        new EspnFetchError('ESPN fetch failed: Network request failed.', 'transport'),
      ),
      true,
    );
    assert.equal(
      isEspnTransportFailure(
        new EspnFetchError(
          "Couldn't load ESPN data. Check your connection and try again.",
          'transport',
        ),
      ),
      true,
    );
    assert.equal(
      isEspnTransportFailure(new EspnFetchError('ESPN request failed with status 503.', 'http')),
      false,
    );
    assert.equal(
      isEspnTransportFailure(new EspnFetchError('Request was cancelled.', 'cancelled')),
      false,
    );
  });

  await test('Quick Links preserve full labels at normal phone widths', () => {
    const labels = ['FCS Top 25', 'FCS vs FBS'] as const;
    for (const width of [360, 390, 430]) {
      for (const label of labels) {
        assert.equal(
          quickLinkLabelFitsAtWidth(label, width),
          true,
          `"${label}" should fit at ${width}pt`,
        );
      }
      // Geometry: icon + chevron never shrink; text gets remaining card width.
      const card = quickLinkCardWidth(width);
      const textMax = quickLinkLabelMaxWidth(card);
      const chrome =
        LAYOUT_COLUMNS.quickLinkIcon +
        LAYOUT_COLUMNS.quickLinkChevron +
        LAYOUT_COLUMNS.quickLinkGap * 2 +
        LAYOUT_COLUMNS.quickLinkPaddingH * 2;
      assert.equal(textMax, card - chrome);
      assert.ok(textMax > chrome, 'text slot must exceed fixed chrome at normal widths');
    }

    // Narrowest practical phone: may ellipsize, but text slot remains > 0.
    assert.ok(quickLinkLabelMaxWidth(quickLinkCardWidth(320)) > 0);
  });

  console.log('\nAll responsive layout tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
