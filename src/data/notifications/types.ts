export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

export type NotificationEventType =
  | 'game_start'
  | 'score'
  | 'quarter_end'
  | 'halftime'
  | 'close_game'
  | 'final';

export type NotificationPreferences = {
  favoriteGamesEnabled: boolean;
  gameStartEnabled: boolean;
  scoreEnabled: boolean;
  quarterEndEnabled: boolean;
  halftimeEnabled: boolean;
  closeGameEnabled: boolean;
  finalEnabled: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  favoriteGamesEnabled: true,
  gameStartEnabled: true,
  scoreEnabled: true,
  quarterEndEnabled: true,
  halftimeEnabled: true,
  closeGameEnabled: true,
  finalEnabled: true,
};

export type FollowedGameRecord = {
  eventId: string;
  awayTeamId?: string;
  homeTeamId?: string;
  awayTeamName: string;
  homeTeamName: string;
  kickoffAt: string;
  notificationsEnabled: boolean;
  expiresAt?: string;
};

export type DeviceRegistrationResult = {
  deviceId: string;
  registered: boolean;
};
