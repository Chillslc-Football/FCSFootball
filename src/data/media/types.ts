export const MEDIA_RESOURCE_TYPES = [
  'podcast',
  'youtube',
  'x_twitter',
  'website',
  'newsletter',
  'facebook',
  'instagram',
  'other',
] as const;

export type MediaResourceType = (typeof MEDIA_RESOURCE_TYPES)[number];

export const MEDIA_SCOPES = ['national', 'team'] as const;
export type MediaScope = (typeof MEDIA_SCOPES)[number];

export const MEDIA_SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type MediaSubmissionStatus = (typeof MEDIA_SUBMISSION_STATUSES)[number];

export const MEDIA_SUBMISSION_TYPES = ['new_creator', 'add_links'] as const;
export type MediaSubmissionType = (typeof MEDIA_SUBMISSION_TYPES)[number];

export type MediaLinkInput = {
  linkType: MediaResourceType;
  url: string;
  label?: string | null;
};

/** Creator-first submission (one or more links). */
export type MediaSubmissionInput = {
  submissionType: MediaSubmissionType;
  existingCreatorId?: string | null;
  proposedName?: string | null;
  proposedDescription?: string | null;
  scope?: MediaScope | null;
  teamId?: string | null;
  teamName?: string | null;
  links: MediaLinkInput[];
  submitterName?: string | null;
  submitterEmail?: string | null;
  submitterNotes?: string | null;
};

export type MediaSubmissionLinkRow = {
  id: string | null;
  link_type: MediaResourceType;
  url: string;
  label: string | null;
  sort_order: number;
};

export type MediaSubmissionRow = {
  id: string;
  submitted_name: string;
  scope: MediaScope;
  team_id: string | null;
  team_name: string | null;
  resource_type: MediaResourceType;
  submitted_url: string;
  submitted_url_normalized: string;
  description: string | null;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_notes: string | null;
  status: MediaSubmissionStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_creator_id: string | null;
  submission_type?: MediaSubmissionType;
  existing_creator_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaSubmissionDetail = {
  submission: MediaSubmissionRow;
  links: MediaSubmissionLinkRow[];
};

export type PublicMediaLink = {
  id: string;
  resource_type: MediaResourceType;
  label: string | null;
  url: string;
  sort_order: number;
};

export type PublicMediaCreator = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  scope: MediaScope;
  team_id: string | null;
  team_name: string | null;
  featured: boolean;
  links: PublicMediaLink[];
};

export type PublicMediaCreatorOption = {
  id: string;
  name: string;
  scope: MediaScope;
  team_name: string | null;
  description: string | null;
};

export const MEDIA_RESOURCE_TYPE_LABELS: Record<MediaResourceType, string> = {
  podcast: 'Podcast',
  youtube: 'YouTube',
  x_twitter: 'X / Twitter',
  website: 'Website',
  newsletter: 'Newsletter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  other: 'Other',
};

export const MEDIA_LINK_FIELD_LABELS: Record<MediaResourceType, string> = {
  podcast: 'Podcast link',
  youtube: 'YouTube channel link',
  x_twitter: 'X profile link',
  website: 'Website link',
  newsletter: 'Newsletter link',
  facebook: 'Facebook page link',
  instagram: 'Instagram profile link',
  other: 'Link',
};

export const MEDIA_LINK_HELPER_TEXT: Partial<Record<MediaResourceType, string>> = {
  podcast: 'Spotify, Apple Podcasts, YouTube, RSS feed, or podcast website',
};

export function getMediaLinkFieldLabel(type: MediaResourceType): string {
  return MEDIA_LINK_FIELD_LABELS[type];
}

export function getMediaLinkHelperText(type: MediaResourceType): string | null {
  return MEDIA_LINK_HELPER_TEXT[type] ?? null;
}
