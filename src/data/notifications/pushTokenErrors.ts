export type PushTokenFailureCategory =
  | 'timeout'
  | 'project_id'
  | 'not_device'
  | 'permission'
  | 'fcm'
  | 'apns'
  | 'native'
  | 'unknown'
  | 'missing';

export type PushTokenFailure = {
  category: PushTokenFailureCategory;
  safeMessage: string;
  updatedAtMs: number;
};

/** Strip token/key-like material before surfacing errors in diagnostics. */
export function sanitizePushTokenErrorMessage(message: string): string {
  return message
    .replace(/ExponentPushToken\[[^\]]+\]/gi, '[redacted]')
    .replace(/ExponentPushToken[^\s]*/gi, '[redacted]')
    .replace(/\beya[a-zA-Z0-9_-]{20,}\b/g, '[redacted]')
    .replace(/\b[A-Za-z0-9+/_-]{40,}\b/g, '[redacted]')
    .slice(0, 160);
}

export function categorizePushTokenError(error: unknown): Omit<PushTokenFailure, 'updatedAtMs'> {
  const raw = error instanceof Error ? error.message : String(error ?? 'unknown');
  const lower = raw.toLowerCase();
  const safeMessage = sanitizePushTokenErrorMessage(raw) || 'Expo push token request failed';

  if (/timed out/i.test(raw)) {
    return { category: 'timeout', safeMessage: 'Expo push token request timed out' };
  }
  if (/projectid|project id|invalid.*project/i.test(lower)) {
    return { category: 'project_id', safeMessage: 'Expo projectId missing or invalid' };
  }
  if (/fcm|firebase|google.?services|default firebaseapp|messaging/i.test(lower)) {
    return { category: 'fcm', safeMessage: 'Android FCM configuration error' };
  }
  if (/apns|aps-environment|push.?notification.?capability/i.test(lower)) {
    return { category: 'apns', safeMessage: 'iOS APNs configuration error' };
  }
  if (/permission|not authorized|denied/i.test(lower)) {
    return { category: 'permission', safeMessage: 'Notification permission not granted for token' };
  }
  if (/simulator|physical device|must be a device/i.test(lower)) {
    return { category: 'not_device', safeMessage: 'Push token requires a physical device' };
  }
  return { category: 'native', safeMessage };
}
