/**
 * ESPN transport retry + production error-copy tests.
 * Run: npm.cmd run test:espn-fetch-retry
 */

import assert from 'node:assert/strict';

import {
  EspnFetchError,
  formatEspnFetchError,
  formatScoresLoadError,
  isEspnTransportFailure,
  withEspnTransportRetry,
} from '@/data/providers/espnFetchErrors';
import { createScoresRequestGeneration } from '@/data/scores/scoresRequestGuard';

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
  await test('A: transport failure then success → exactly 2 attempts', async () => {
    let attempts = 0;
    const result = await withEspnTransportRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new EspnFetchError('ESPN fetch failed: Network request failed.', 'transport');
        }
        return 'ok';
      },
      { delayMs: 1, sleep: async () => undefined },
    );
    assert.equal(result, 'ok');
    assert.equal(attempts, 2);
  });

  await test('A2: production-formatted transport error still retries', async () => {
    let attempts = 0;
    const result = await withEspnTransportRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          // Same shape produced by formatEspnFetchError in production builds.
          throw new EspnFetchError(
            "Couldn't load ESPN data. Check your connection and try again.",
            'transport',
          );
        }
        return 'recovered';
      },
      { delayMs: 1, sleep: async () => undefined },
    );
    assert.equal(result, 'recovered');
    assert.equal(attempts, 2);
  });

  await test('B: two transport failures → exactly 2 attempts then error', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            attempts += 1;
            throw new TypeError('Network request failed');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      (err: unknown) => err instanceof TypeError && err.message.includes('Network request failed'),
    );
    assert.equal(attempts, 2);
  });

  await test('C: HTTP error → no transport retry', async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            attempts += 1;
            throw new EspnFetchError('ESPN request failed with status 503.', 'http');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      /status 503/,
    );
    assert.equal(attempts, 1);
  });

  await test('D: malformed JSON / parser-style errors → no transport retry', async () => {
    let jsonAttempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            jsonAttempts += 1;
            throw new EspnFetchError('ESPN response was not valid JSON.', 'json');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      /not valid JSON/,
    );
    assert.equal(jsonAttempts, 1);

    let parserAttempts = 0;
    await assert.rejects(
      () =>
        withEspnTransportRetry(
          async () => {
            parserAttempts += 1;
            throw new Error('ESPN returned invalid data: expected a JSON object.');
          },
          { delayMs: 1, sleep: async () => undefined },
        ),
      /invalid data/,
    );
    assert.equal(parserAttempts, 1);
  });

  await test('E: production error text contains no Expo Go', () => {
    const mapped = formatEspnFetchError(new TypeError('Network request failed'), 8000);
    assert.equal(mapped.code, 'transport');
    assert.doesNotMatch(mapped.message, /Expo Go/i);
    assert.match(mapped.message, /connection|try again/i);

    const scoresMessage = formatScoresLoadError(new TypeError('Network request failed'));
    assert.doesNotMatch(scoresMessage, /Expo Go/i);
    assert.doesNotMatch(scoresMessage, /TypeError/i);
    assert.match(scoresMessage, /Scores couldn't be loaded/i);
  });

  await test('F: retry success does not commit an intermediate error state', async () => {
    let visibleError: string | null = null;
    let loadState: 'loading' | 'success' | 'error' = 'loading';

    // Mirrors Scores: set loading, await full fetch (including retry), then commit error only on final failure.
    const runLoad = async () => {
      loadState = 'loading';
      visibleError = null;
      try {
        await withEspnTransportRetry(
          async () => {
            if (loadState === 'error' || visibleError) {
              throw new Error('error UI was painted before retry completed');
            }
            throw new EspnFetchError('ESPN fetch failed: Network request failed.', 'transport');
          },
          {
            delayMs: 1,
            sleep: async () => {
              // Still loading while waiting to retry — no error paint yet.
              assert.equal(loadState, 'loading');
              assert.equal(visibleError, null);
            },
          },
        );
      } catch (err) {
        // First scenario below recovers; this path used for double-failure check separately.
        visibleError = formatScoresLoadError(err);
        loadState = 'error';
      }
    };

    // Recovering path:
    loadState = 'loading';
    visibleError = null;
    let attempts = 0;
    const value = await withEspnTransportRetry(
      async () => {
        attempts += 1;
        assert.equal(loadState, 'loading');
        assert.equal(visibleError, null);
        if (attempts === 1) {
          throw new EspnFetchError('ESPN fetch failed: Network request failed.', 'transport');
        }
        return 'board';
      },
      { delayMs: 1, sleep: async () => undefined },
    );
    loadState = 'success';
    assert.equal(value, 'board');
    assert.equal(visibleError, null);
    assert.equal(loadState, 'success');
    assert.equal(attempts, 2);

    // Persistent failure path still ends in error after both attempts:
    await runLoad();
    assert.equal(loadState, 'error');
    assert.ok(visibleError);
    assert.doesNotMatch(visibleError, /Expo Go/i);
  });

  await test('G: request guard still ignores stale completion', () => {
    const gen = createScoresRequestGeneration();
    const first = gen.bump();
    const second = gen.bump();
    assert.equal(gen.isCurrent(first), false);
    assert.equal(gen.isCurrent(second), true);
    // Stale initial attempt must not apply — same contract Scores uses after await.
    assert.equal(first < second, true);
  });

  await test('timeouts and cancellations are not transport retries', () => {
    assert.equal(
      isEspnTransportFailure(new EspnFetchError('ESPN fetch timed out after 8 seconds.', 'timeout')),
      false,
    );
    assert.equal(
      isEspnTransportFailure(new EspnFetchError('Request was cancelled.', 'cancelled')),
      false,
    );
  });

  console.log('\nAll ESPN fetch retry tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
