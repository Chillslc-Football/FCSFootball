-- Ensure optional notes column exists on media_suggestions.
-- Safe if the column was already created by 20260726150000_media_sources.sql.

alter table public.media_suggestions
  add column if not exists notes text;

comment on column public.media_suggestions.notes is
  'Optional submitter notes for a pending FCS Media suggestion.';
