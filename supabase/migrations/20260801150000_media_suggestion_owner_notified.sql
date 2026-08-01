-- Durable owner-notification flag for media suggestions (email idempotency).

alter table public.media_suggestions
  add column if not exists owner_notified_at timestamptz;

comment on column public.media_suggestions.owner_notified_at is
  'Set when the owner notification email was successfully sent for this suggestion.';

notify pgrst, 'reload schema';
