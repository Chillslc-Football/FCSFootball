-- App feedback (general product feedback — not media suggestion/correction queues).
-- Client: RPC save → Edge Function notify-by-id (Resend), best-effort email.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  email text,
  category text,
  created_at timestamptz not null default now(),
  owner_notified_at timestamptz
);

alter table public.app_feedback
  drop constraint if exists app_feedback_category_check;

alter table public.app_feedback
  add constraint app_feedback_category_check
  check (
    category is null
    or category in ('bug', 'idea', 'other')
  );

alter table public.app_feedback enable row level security;

revoke all on table public.app_feedback from anon, authenticated;
grant select, insert, update on table public.app_feedback to service_role;

create or replace function public.submit_app_feedback(
  p_message text,
  p_email text default null,
  p_category text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text := nullif(trim(coalesce(p_message, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_category text := lower(nullif(trim(coalesce(p_category, '')), ''));
  v_id uuid;
begin
  if v_message is null then
    raise exception 'Feedback message is required';
  end if;

  if char_length(v_message) > 5000 then
    raise exception 'Feedback is too long';
  end if;

  if v_email is not null and char_length(v_email) > 320 then
    raise exception 'Email is too long';
  end if;

  if v_category is not null and v_category not in ('bug', 'idea', 'other') then
    raise exception 'Invalid feedback category';
  end if;

  insert into public.app_feedback (message, email, category)
  values (v_message, v_email, v_category)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_app_feedback(text, text, text) from public;
grant execute on function public.submit_app_feedback(text, text, text)
  to anon, authenticated, service_role;
