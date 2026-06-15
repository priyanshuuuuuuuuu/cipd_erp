# install_startup.ps1
# Run as Administrator to register WiFiMonitor as a boot startup task.
# No user login required - starts 60s after Windows boots.

param(
    [string]$TaskName    = "WiFiMonitorWatchdog",
    [string]$Description = "Keeps wifi_monitor.py running from boot, no login required"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

$PythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    $PythonExe = (Get-Command python3 -ErrorAction SilentlyContinue).Source
}
if (-not $PythonExe) {
    Write-Error "Python not found on PATH. Install Python and try again."
    exit 1
}

$WatchdogScript = Join-Path $ScriptDir "watchdog.py"
if (-not (Test-Path $WatchdogScript)) {
    Write-Error "watchdog.py not found at: $WatchdogScript"
    exit 1
}

Write-Host "Python   : $PythonExe"
Write-Host "Watchdog : $WatchdogScript"
Write-Host "Task name: $TaskName"
Write-Host ""

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Removing existing task..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$WatchdogScript`"" `
    -WorkingDirectory $ScriptDir

$Trigger = New-ScheduledTaskTrigger -AtStartup
$Trigger.Delay = "PT60S"

$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit "00:00:00" `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

$Principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description $Description `
    -Force | Out-Null

Write-Host "Task '$TaskName' registered successfully."
Write-Host "Starts 60s after every Windows boot. Runs as SYSTEM, no login needed."
Write-Host ""
Write-Host "Commands:"
Write-Host "  Start : Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop  : Stop-ScheduledTask  -TaskName '$TaskName'"
Write-Host "  Remove: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""

$Answer = Read-Host "Start the task right now? (y/N)"
if ($Answer -match "^[Yy]") {
    Start-ScheduledTask -TaskName $TaskName
    Write-Host "Task started."
}
