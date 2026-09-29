[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$ResumeKnownState,
  [string]$ConnectionString = $env:SHOWCASE_DATABASE_URL,
  [string]$Psql = 'psql'
)

$ErrorActionPreference = 'Stop'
$projectRef = 'xssjgzzhcudktrkruitb'
$migrationRoot = Join-Path $PSScriptRoot 'showcase-migrations'
$validationRoot = Join-Path $PSScriptRoot 'showcase-validation'
$manifestPath = Join-Path $migrationRoot 'checksums.sha256'
$expectedFiles = @(
  '001_create_showcase_schema.sql',
  '002_create_public_media_predicate.sql',
  '003_create_showcase_rls.sql',
  '004_create_showcase_storage_policies.sql',
  '005_create_showcase_auditing.sql',
  '006_create_landing_publish_function.sql',
  '007_complete_atomic_landing_and_auditing.sql'
)
$migrationCount = $expectedFiles.Count

if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Checksum manifest is missing.' }
$files = Get-ChildItem -LiteralPath $migrationRoot -Filter '*.sql' | Sort-Object Name
if ($files.Count -ne $migrationCount) { throw "Expected $migrationCount showcase migrations; found $($files.Count)." }
for ($index = 0; $index -lt $migrationCount; $index++) {
  if ($files[$index].Name -ne $expectedFiles[$index]) { throw "Migration ordering/file mismatch at position $($index + 1)." }
}

$manifest = @{}
foreach ($line in Get-Content -LiteralPath $manifestPath) {
  if ($line -notmatch '^([a-fA-F0-9]{64})\s{2}(.+\.sql)$') { throw "Invalid checksum manifest line: $line" }
  $manifest[$Matches[2]] = $Matches[1].ToLowerInvariant()
}
if ($manifest.Count -ne $migrationCount) { throw "Expected $migrationCount checksum manifest entries; found $($manifest.Count)." }
foreach ($file in $files) {
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
  if (-not $manifest.ContainsKey($file.Name) -or $manifest[$file.Name] -ne $actual) { throw "Checksum mismatch: $($file.Name)" }
}

Write-Host "Target project ref: $projectRef"
Write-Host "Verified: $migrationCount ordered SQL files match checksums.sha256."
Write-Host 'Planned objects: showcase schema/tables/functions/triggers/RLS/grants, plus showcase-media-only storage policies.'
Write-Host 'Security impact: published public rows become readable; public/private writes remain admin-gated by public.is_admin(); private partner data remains admin-only.'
Write-Host 'Expected verification: showcase.schema_migrations contains 001-007 with exact hashes; all showcase tables retain RLS.'

if (-not $Apply) {
  Write-Host 'Plan only. Re-run with -Apply and SHOWCASE_DATABASE_URL to execute.'
  exit 0
}
if (-not $ConnectionString) { throw 'SHOWCASE_DATABASE_URL is required for -Apply.' }
try { $connectionUri = [Uri]$ConnectionString } catch { throw 'SHOWCASE_DATABASE_URL must be a PostgreSQL URI.' }
$connectionUser = [Uri]::UnescapeDataString(($connectionUri.UserInfo -split ':', 2)[0])
$connectionIdentity = "$($connectionUri.Host)|$connectionUser"
$connectionDatabase = $connectionUri.AbsolutePath.TrimEnd('/')
if (($connectionUri.Scheme -notin @('postgres', 'postgresql')) -or
    ($connectionIdentity -notmatch [regex]::Escape($projectRef)) -or
    ($connectionDatabase -ne '/postgres')) {
  throw "Database URI must identify project $projectRef and its postgres database."
}
if (-not (Get-Command $Psql -ErrorAction SilentlyContinue)) { throw "psql was not found: $Psql" }

$previousPgDatabase = [Environment]::GetEnvironmentVariable('PGDATABASE', 'Process')
$env:PGDATABASE = $ConnectionString
try {
  $dependenciesOk = (& $Psql -X --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="select to_regprocedure('public.is_admin()') is not null and pg_get_function_result(to_regprocedure('public.is_admin()')) = 'boolean' and has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') and to_regclass('storage.objects') is not null;").Trim()
  if ($LASTEXITCODE -ne 0 -or $dependenciesOk -ne 't') { throw 'Required existing public.is_admin() authorization or storage.objects dependency is missing or incompatible.' }
  $schemaExists = (& $Psql -X --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="select to_regnamespace('showcase') is not null;").Trim()
  if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect target database state.' }
  if ($schemaExists -eq 't') {
    if (-not $ResumeKnownState) { throw 'The showcase schema already exists. Inspect it first, then re-run with -ResumeKnownState only if its ledger is trusted.' }
    $ledgerRows = @(& $Psql -X --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="select version || '|' || sha256 from showcase.schema_migrations order by version::numeric;") | Where-Object { $_ }
    if ($LASTEXITCODE -ne 0 -or $ledgerRows.Count -eq 0) { throw 'Existing showcase schema has no readable migration ledger.' }
    for ($index = 0; $index -lt $ledgerRows.Count; $index++) {
      if ($index -ge $migrationCount) { throw 'Existing showcase migration ledger contains an unexpected version.' }
      $parts = $ledgerRows[$index].Trim().Split('|', 2)
      $expectedVersion = $expectedFiles[$index].Substring(0, 3)
      if ($parts.Count -ne 2 -or $parts[0] -ne $expectedVersion -or $parts[1] -ne $manifest[$expectedFiles[$index]]) {
        throw 'Existing showcase migration ledger is unknown, non-sequential, or has a checksum mismatch.'
      }
    }
    Write-Host "Verified existing showcase ledger prefix through $($ledgerRows.Count) migration(s)."
  }

  Push-Location $validationRoot
  try {
    foreach ($file in $files) {
      $version = $file.BaseName.Substring(0, 3)
      $name = $file.BaseName.Substring(4)
      $sha = $manifest[$file.Name]
      Write-Host "Applying $($file.Name) to $projectRef"
      if ($version -eq '001') {
        & $Psql -X --set=ON_ERROR_STOP=1 --set="migration_sha256=$sha" --file='apply-001.sql'
      } else {
        $previous = '{0:D3}' -f ([int]$version - 1)
        & $Psql -X --set=ON_ERROR_STOP=1 --set="migration_version=$version" --set="previous_version=$previous" --set="migration_name=$name" --set="migration_sha256=$sha" --set="migration_file=../showcase-migrations/$($file.Name)" --file='apply-next.sql'
      }
      if ($LASTEXITCODE -ne 0) { throw "Migration $version failed; transaction rolled back." }
      $record = (& $Psql -X --tuples-only --no-align --set=ON_ERROR_STOP=1 --command="select version || '|' || sha256 from showcase.schema_migrations where version='$version';").Trim()
      if ($LASTEXITCODE -ne 0 -or $record -ne "$version|$sha") { throw "Migration $version ledger verification failed." }
      Write-Host "Verified ledger version $version and checksum."
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($null -eq $previousPgDatabase) { Remove-Item Env:PGDATABASE -ErrorAction SilentlyContinue } else { $env:PGDATABASE = $previousPgDatabase }
}

Write-Host "All $migrationCount showcase migrations are applied and independently verified."
