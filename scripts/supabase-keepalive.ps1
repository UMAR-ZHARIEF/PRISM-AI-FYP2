<#
.SYNOPSIS
    Daily Supabase keep-alive ping (local Windows Task Scheduler fallback).

.DESCRIPTION
    The hosted Supabase project (free tier) auto-pauses after roughly one
    week without API traffic. This script sends one tiny authenticated REST
    request so the project never goes idle:

        GET {SUPABASE_URL}/rest/v1/years?select=year_num&limit=1

    It uses the PUBLIC anon key (least privilege - the same key the frontend
    ships with). Credentials are read at runtime from
    PRISM-ai--web/.env.local (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
    NOTHING is hardcoded here because the repo is public.

    Every run appends exactly one line to scripts/keepalive.log:
        2026-07-04 09:00:03  OK (1 row)
        2026-07-04 09:00:03  FAIL <reason>
    Once the log exceeds 200 lines it is trimmed to its last 100.

    Exit code: 0 on success, 1 on any failure.

    Register the daily 09:00 scheduled task once with:
        scripts/register-keepalive-task.ps1
    (The primary keep-alive is .github/workflows/supabase-keepalive.yml;
    this script covers its gaps, e.g. GitHub disabling cron schedules on
    public repos after 60 days without pushes.)

.NOTES
    Compatible with both Windows PowerShell 5.1 (what Task Scheduler
    invokes) and PowerShell 7+.
#>

$LogPath = Join-Path $PSScriptRoot 'keepalive.log'

function Write-KeepaliveLog {
    param([Parameter(Mandatory = $true)][string]$Status)

    $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Status
    Add-Content -Path $LogPath -Value $line

    # Keep the log bounded: once it grows past 200 lines, keep the last 100.
    $lines = @(Get-Content -Path $LogPath)
    if ($lines.Count -gt 200) {
        $lines | Select-Object -Last 100 | Set-Content -Path $LogPath
    }

    Write-Host $line
}

# --- 1. Read credentials from the frontend's local env file (never hardcoded) ---
$envFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\PRISM-ai--web\.env.local'))

if (-not (Test-Path -Path $envFile -PathType Leaf)) {
    Write-KeepaliveLog "FAIL env file not found: $envFile"
    exit 1
}

# Simple .env parse: KEY=VALUE per line, trims whitespace, skips blank lines
# and # comments, strips optional surrounding quotes from the value.
$envVars = @{}
foreach ($rawLine in Get-Content -Path $envFile) {
    $line = "$rawLine".Trim()
    if ($line -eq '' -or $line.StartsWith('#')) { continue }
    $eqIndex = $line.IndexOf('=')
    if ($eqIndex -lt 1) { continue }
    $key   = $line.Substring(0, $eqIndex).Trim()
    $value = $line.Substring($eqIndex + 1).Trim().Trim('"').Trim("'")
    $envVars[$key] = $value
}

$supabaseUrl = $envVars['VITE_SUPABASE_URL']
$anonKey     = $envVars['VITE_SUPABASE_ANON_KEY']

if ([string]::IsNullOrWhiteSpace($supabaseUrl) -or [string]::IsNullOrWhiteSpace($anonKey)) {
    Write-KeepaliveLog "FAIL VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY missing in $envFile"
    exit 1
}

# --- 2. Ping the REST API (cheapest possible authenticated query) ---
$pingUrl = '{0}/rest/v1/years?select=year_num&limit=1' -f $supabaseUrl.TrimEnd('/')
$headers = @{
    'apikey'        = $anonKey
    'Authorization' = "Bearer $anonKey"
}

# Ensure TLS 1.2 under Windows PowerShell 5.1 (harmless no-op on PowerShell 7+).
[Net.ServicePointManager]::SecurityProtocol = `
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

try {
    $response = Invoke-RestMethod -Uri $pingUrl -Method Get -Headers $headers `
        -TimeoutSec 30 -ErrorAction Stop
    $rowCount = @($response).Count
    $rowWord  = if ($rowCount -eq 1) { 'row' } else { 'rows' }
    Write-KeepaliveLog ('OK ({0} {1})' -f $rowCount, $rowWord)
    exit 0
}
catch {
    # Flatten the error onto a single log line (no stack trace spew).
    $reason = ("$($_.Exception.Message)" -replace '\s*[\r\n]+\s*', ' ').Trim()
    if ($reason -eq '') { $reason = 'unknown error' }
    Write-KeepaliveLog "FAIL $reason"
    exit 1
}
