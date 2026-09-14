$ProjectDir = "C:\Users\win11.BT-20989\.gemini\antigravity\scratch\bordo-mavi-ai-editor"
$LockFile = "$ProjectDir\sync-news-cron.lock"
$LogFile = "$ProjectDir\sync-news-cron.log"
$EnvFile = "$ProjectDir\.env"

if (Test-Path $LockFile) {
    $msg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [WARN] Another instance is already running. Exiting."
    Add-Content -Path $LogFile -Value $msg
    exit
}

New-Item -Path $LockFile -ItemType File -Force | Out-Null

try {
    $CronSecret = ""
    if (Test-Path $EnvFile) {
        foreach ($line in Get-Content $EnvFile) {
            if ($line -match "^CRON_SECRET=(.*)$") {
                $CronSecret = $matches[1].Trim('"', "'", ' ')
                break
            }
        }
    }

    if (-not $CronSecret) {
        throw "CRON_SECRET not found in .env file"
    }

    $Url = "http://localhost:3000/api/cron/sync-news?secret=$CronSecret"
    $msgStart = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] Requesting: $Url"
    Add-Content -Path $LogFile -Value $msgStart

    $Response = Invoke-RestMethod -Uri $Url -Method Get -ErrorAction Stop
    $ResponseJson = $Response | ConvertTo-Json -Depth 5 -Compress
    
    $msgSuccess = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SUCCESS] $ResponseJson"
    Add-Content -Path $LogFile -Value $msgSuccess
} catch {
    $msgError = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ERROR] $($_.Exception.Message)"
    Add-Content -Path $LogFile -Value $msgError
} finally {
    if (Test-Path $LockFile) {
        Remove-Item -Path $LockFile -Force
    }
}
