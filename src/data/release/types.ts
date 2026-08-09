export type AppReleasePlatform = 'ios' | 'android';

export type AppUpdateState = 'current' | 'optional_update' | 'required_update';

export type AppReleasePolicyRow = {
  platform: AppReleasePlatform;
  latestBuild: number;
  minimumSupportedBuild: number;
  latestVersion: string;
  updateMessage: string | null;
  requiredUpdateMessage: string | null;
  storeUrl: string;
  updatedAt: string | null;
};

export type ResolveAppUpdateStateInput = {
  platform: AppReleasePlatform;
  installedBuild: number | null | undefined;
  latestBuild: number | null | undefined;
  minimumSupportedBuild: number | null | undefined;
};

export type AppUpdateDecision = {
  state: AppUpdateState;
  /** True when policy/build inputs were invalid and we failed open to current. */
  failOpen: boolean;
  reason?: string;
};
