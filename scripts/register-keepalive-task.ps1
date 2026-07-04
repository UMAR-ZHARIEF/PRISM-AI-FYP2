<#
.SYNOPSIS
    One-time installer: registers the daily Supabase keep-alive Scheduled Task.

.DESCRIPTION
    Idempotently registers (re-running simply overwrites, via -Force) a
    Windows Scheduled Task:

        Name     : PRISM-AI Supabase Keepalive
        Schedule : daily at 09:00; if the machine was off or asleep at
                   09:00, the missed run fires as soon as it can
                   (StartWhenAvailable)
        Action   : powershell.exe -NoProfile -ExecutionPolicy Bypass
                       -File "<this folder>\supabase-keepalive.ps1"

    The absolute path to supabase-keepalive.ps1 is computed from this
    script's own location at registration time, so run this from wherever
    the repo is checked out.

    Run it ONCE in a normal PowerShell window - no admin needed for a
    current-user task:

        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\register-keepalive-task.ps1

    This only registers the task; it does not run the keep-alive itself.
    Results of each daily run land in scripts/keepalive.log.
#>

$TaskName = 'PRISM-AI Supabase Keepalive'

# Absolute path to the keep-alive script, derived from this script's location.
$keepaliveScript = Join-Path $PSScriptRoot 'supabase-keepalive.ps1'
if (-not (Test-Path -Path $keepaliveScript -PathType Leaf)) {
    Write-Error "Cannot find supabase-keepalive.ps1 next to this script (looked at: $keepaliveScript)."
    exit 1
}
$keepaliveScript = (Resolve-Path -Path $keepaliveScript).Path

$argumentString = '-NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $keepaliveScript

$action  = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentString
$trigger = New-ScheduledTaskTrigger -Daily -At '09:00'

# StartWhenAvailable: run a missed 09:00 (laptop asleep/off) at next
# opportunity instead of skipping the day.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

try {
    $task = Register-ScheduledTask -TaskName $TaskName `
        -Action $action -Trigger $trigger -Settings $settings `
        -Description 'Daily REST ping so the free-tier Supabase project is not auto-paused. Local fallback for .github/workflows/supabase-keepalive.yml. Logs to scripts/keepalive.log.' `
        -Force
}
catch {
    Write-Error "Failed to register scheduled task '$TaskName': $($_.Exception.Message)"
    exit 1
}

$nextRun = $null
try { $nextRun = ($task | Get-ScheduledTaskInfo).NextRunTime } catch { }

Write-Host ''
Write-Host "Registered scheduled task: '$TaskName'"
Write-Host '  Schedule : daily at 09:00 (missed runs fire at next wake, StartWhenAvailable)'
Write-Host "  Action   : powershell.exe $argumentString"
if ($nextRun) {
    Write-Host "  Next run : $nextRun"
}
Write-Host "  Log file : $(Join-Path $PSScriptRoot 'keepalive.log')"
Write-Host ''
Write-Host 'Verify   : Get-ScheduledTask -TaskName "PRISM-AI Supabase Keepalive" | Get-ScheduledTaskInfo'
Write-Host 'Test now : Start-ScheduledTask -TaskName "PRISM-AI Supabase Keepalive"'
Write-Host 'Remove   : Unregister-ScheduledTask -TaskName "PRISM-AI Supabase Keepalive" -Confirm:$false'
exit 0
