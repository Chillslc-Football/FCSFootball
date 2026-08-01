import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token purpose: `review` is preferred; approve/reject kept for legacy links. */
export type MediaSuggestionReviewTokenAction = 'review' | 'approve' | 'reject';

export type MediaSuggestionReviewTokenPayload = {
  v: 1;
  sid: string;
  act: MediaSuggestionReviewTokenAction;
  exp: number;
  n: string;
};

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function getMediaSuggestionReviewTokenTtlSeconds(): number {
  return TOKEN_TTL_SECONDS;
}

export function hashMediaSuggestionReviewNonce(nonce: string): string {
  return createHash('sha256').update(nonce, 'utf8').digest('hex');
}

export function createMediaSuggestionReviewNonce(): string {
  return randomBytes(32).toString('base64url');
}

function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function base64UrlDecodeToString(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64url');
}

export function issueMediaSuggestionReviewToken(input: {
  secret: string;
  suggestionId: string;
  action?: MediaSuggestionReviewTokenAction;
  nonce: string;
  nowMs?: number;
}): string {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const payload: MediaSuggestionReviewTokenPayload = {
    v: 1,
    sid: input.suggestionId,
    act: input.action ?? 'review',
    exp: nowSec + TOKEN_TTL_SECONDS,
    n: input.nonce,
  };
  const body = base64UrlEncodeJson(payload);
  const sig = signPayload(input.secret, body);
  return `${body}.${sig}`;
}

export type VerifyMediaSuggestionReviewTokenResult =
  | { ok: true; payload: MediaSuggestionReviewTokenPayload }
  | {
      ok: false;
      reason: 'invalid_token' | 'expired_token' | 'invalid_action';
    };

export function verifyMediaSuggestionReviewToken(input: {
  secret: string;
  token: string;
  nowMs?: number;
}): VerifyMediaSuggestionReviewTokenResult {
  const trimmed = input.token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'invalid_token' };
  const [body, sig] = parts;
  if (!body || !sig) return { ok: false, reason: 'invalid_token' };

  const expected = signPayload(input.secret, body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: 'invalid_token' };
  }

  let payload: MediaSuggestionReviewTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(body)) as MediaSuggestionReviewTokenPayload;
  } catch {
    return { ok: false, reason: 'invalid_token' };
  }

  if (
    payload?.v !== 1 ||
    typeof payload.sid !== 'string' ||
    typeof payload.n !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'invalid_token' };
  }
  if (payload.act !== 'review' && payload.act !== 'approve' && payload.act !== 'reject') {
    return { ok: false, reason: 'invalid_action' };
  }

  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (payload.exp < nowSec) {
    return { ok: false, reason: 'expired_token' };
  }

  return { ok: true, payload };
}
