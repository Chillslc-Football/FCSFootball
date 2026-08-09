-- Manual / ops runbook: poll-espn-games cron auth via Supabase Vault
-- Project: fcs-football (bvieukwpiywaakmyfjci)
--
-- DO NOT put service-role / secret key values in this file or in git.
-- Seed the Vault secret out-of-band (Dashboard Vault UI or
-- scripts/fix-poll-espn-games-cron-auth.ps1), then apply the cron.alter_job
-- below (or re-run the script).
--
-- Required Vault secret name:
--   poll_espn_games_service_role_key
-- Value:
--   legacy service_role JWT (eyJ...) from Project Settings → API
--
-- verify_jwt remains true on the Edge Function; Authorization Bearer must be a JWT.

-- 1) Confirm secret present (lengths only)
select
  (select count(*)::int from vault.secrets where name = 'poll_espn_games_service_role_key') as secret_rows,
  (select length(decrypted_secret)
   from vault.decrypted_secrets
   where name = 'poll_espn_games_service_role_key'
   limit 1) as secret_len;

-- 2) Update existing job (keep schedule; do not create duplicates)
--    Adjust job_id if needed: select jobid, jobname from cron.job where jobname = 'poll-espn-games';
select cron.alter_job(
  job_id := 1,
  schedule := '* * * * *',
  command := $cmd$
select net.http_post(
  url := 'https://bvieukwpiywaakmyfjci.supabase.co/functions/v1/poll-espn-games',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_espn_games_service_role_key'),
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'poll_espn_games_service_role_key')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 25000
);
$cmd$,
  database := null,
  username := null,
  active := true
);

-- 3) Sanity checks
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'poll-espn-games';

-- 4) Recent HTTP outcomes (expect 2xx after fix)
select id, status_code, timed_out, created,
       left(coalesce(content::text, ''), 160) as content_preview
from net._http_response
order by id desc
limit 10;

-- Simple future health check (not alerting):
-- select status_code, count(*)
-- from net._http_response
-- where created > now() - interval '15 minutes'
-- group by 1;
