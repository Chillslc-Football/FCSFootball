# Seeds Vault + repairs poll-espn-games cron auth (no secret values printed).
# Usage: powershell -File scripts/fix-poll-espn-games-cron-auth.ps1

$ErrorActionPreference = 'Stop'
$ProjectRef = 'bvieukwpiywaakmyfjci'
$VaultSecretName = 'poll_espn_games_service_role_key'
$FunctionUrl = "https://$ProjectRef.supabase.co/functions/v1/poll-espn-games"
$TimeoutMs = 25000

function Invoke-DbQuery([string]$Sql) {
  $tmp = Join-Path $env:TEMP ("fcs_sql_" + [guid]::NewGuid().ToString('N') + '.sql')
  try {
    # utf8NoBOM avoids Postgres encoding issues on Windows
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tmp, $Sql, $utf8NoBom)
    $raw = Get-Content -LiteralPath $tmp -Raw
    # supabase CLI prints progress on stderr; do not treat that as terminating.
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $out = & supabase db query --linked $raw 2>&1 | ForEach-Object { "$_" } | Out-String
      $code = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $prev
    }
    if ($code -ne 0) {
      throw "supabase db query failed (exit $code): $out"
    }
    return $out
  }
  finally {
    if (Test-Path -LiteralPath $tmp) {
      Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Host 'Fetching project API keys (values not printed)...'
$keysJson = supabase projects api-keys --project-ref $ProjectRef -o json 2>$null
if (-not $keysJson) { throw 'Failed to list project API keys.' }
$keys = $keysJson | ConvertFrom-Json
$serviceRole = $null
foreach ($k in $keys) {
  if ($k.name -eq 'service_role') {
    $serviceRole = [string]$k.api_key
    if (-not $serviceRole) { $serviceRole = [string]$k.key }
    break
  }
}
if (-not $serviceRole) { throw 'service_role API key not found.' }
if (-not $serviceRole.StartsWith('eyJ')) {
  throw 'service_role key is not a legacy JWT; verify_jwt=true requires a JWT Bearer token.'
}
Write-Host ("service_role key kind=legacy_jwt len={0}" -f $serviceRole.Length)

Write-Host 'Upserting Vault secret by name (value not printed)...'
# Remove prior secret with same name if present (id only).
$existingOut = Invoke-DbQuery @"
select id::text as id
from vault.secrets
where name = '$VaultSecretName'
limit 1;
"@
$existingId = $null
if ($existingOut -match '"id"\s*:\s*"([0-9a-f-]+)"') {
  $existingId = $Matches[1]
}

$escaped = $serviceRole.Replace("'", "''")
if ($existingId) {
  Invoke-DbQuery @"
select vault.update_secret(
  '$existingId'::uuid,
  '$escaped',
  '$VaultSecretName',
  'Service role JWT for poll-espn-games cron Authorization/apikey headers. Not for client use.',
  null
);
"@ | Out-Null
  Write-Host 'Vault secret updated.'
}
else {
  Invoke-DbQuery @"
select vault.create_secret(
  '$escaped',
  '$VaultSecretName',
  'Service role JWT for poll-espn-games cron Authorization/apikey headers. Not for client use.',
  null
);
"@ | Out-Null
  Write-Host 'Vault secret created.'
}

# Clear plaintext from memory ASAP
$serviceRole = $null
$escaped = $null
[GC]::Collect()

Write-Host 'Verifying Vault secret exists (presence only)...'
$verifyVault = Invoke-DbQuery @"
select
  (select count(*)::int from vault.secrets where name = '$VaultSecretName') as secret_rows,
  (select length(decrypted_secret) from vault.decrypted_secrets where name = '$VaultSecretName' limit 1) as secret_len;
"@
Write-Host $verifyVault

Write-Host 'Updating cron job command (schedule unchanged)...'
$cronCommand = @"
select net.http_post(
  url := '$FunctionUrl',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '$VaultSecretName'),
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = '$VaultSecretName')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := $TimeoutMs
);
"@
# Escape single quotes in command for SQL string literal used by alter_job
$cronCommandSqlLiteral = $cronCommand.Replace("'", "''")

Invoke-DbQuery @"
select cron.alter_job(
  job_id := 1,
  schedule := '* * * * *',
  command := '$cronCommandSqlLiteral',
  database := null,
  username := null,
  active := true
);
"@ | Out-Null

Write-Host 'Confirming single active job...'
$jobOut = Invoke-DbQuery @"
select jobid, jobname, schedule, active, command
from cron.job
where jobname = 'poll-espn-games'
order by jobid;
"@
Write-Host $jobOut

Write-Host 'Manual authenticated invoke via same Vault auth path...'
$manualOut = Invoke-DbQuery @"
select net.http_post(
  url := '$FunctionUrl',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '$VaultSecretName'),
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = '$VaultSecretName')
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := $TimeoutMs
) as request_id;
"@
Write-Host $manualOut

Write-Host 'Waiting 8s for pg_net response...'
Start-Sleep -Seconds 8

$respOut = Invoke-DbQuery @"
select id, status_code, timed_out,
  left(coalesce(error_msg, ''), 120) as error_msg,
  left(coalesce(content::text, ''), 240) as content_preview,
  created
from net._http_response
order by id desc
limit 3;
"@
Write-Host $respOut
Write-Host 'Done.'
