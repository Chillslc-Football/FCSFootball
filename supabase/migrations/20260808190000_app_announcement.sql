-- Simple owner Home announcement (text-only, single active message).
-- Clients: SELECT for everyone. UPDATE only for is_app_admin().
-- Initial state: inactive + blank — applying this migration shows nothing on Home.

create table if not exists public.app_announcement (
  id uuid primary key default gen_random_uuid(),
  message text not null default '',
  active boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.app_announcement is
  'Singleton-style Home announcement. Prefer one row; clients read the latest by updated_at.';

drop trigger if exists app_announcement_set_updated_at on public.app_announcement;
create trigger app_announcement_set_updated_at
  before update on public.app_announcement
  for each row execute function public.set_updated_at();

alter table public.app_announcement enable row level security;

revoke all on table public.app_announcement from anon, authenticated;
grant select on table public.app_announcement to anon, authenticated;
grant update on table public.app_announcement to authenticated;
grant all on table public.app_announcement to service_role;

drop policy if exists "app_announcement_public_read" on public.app_announcement;
create policy "app_announcement_public_read"
  on public.app_announcement
  for select
  to anon, authenticated
  using (true);

drop policy if exists "app_announcement_admin_update" on public.app_announcement;
create policy "app_announcement_admin_update"
  on public.app_announcement
  for update
  to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- Safe seed: inactive blank message (no Home banner after migrate).
insert into public.app_announcement (id, message, active)
values (
  '00000000-0000-4000-8000-0000000000a1',
  '',
  false
)
on conflict (id) do nothing;
