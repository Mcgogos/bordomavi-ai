$ProjectDir = "C:\Users\win11.BT-20989\.gemini\antigravity\scratch\bordo-mavi-ai-editor"
$LockFile = "$ProjectDir\sync-news-cron.lock"
$LogFile = "$ProjectDir\sync-news-cron.log"
$EnvFile = "$ProjectDir\.env"

if (Test-Path $LockFile) {
    $lockAge = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($lockAge.TotalMinutes -gt 15) {
        $msgStale = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [WARN] Stale lock file detected (age: $([math]::Round($lockAge.TotalMinutes, 1)) mins). Auto-removing lock."
        Add-Content -Path $LogFile -Value $msgStale
        Remove-Item -Path $LockFile -Force
    } else {
        $msg = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [WARN] Another instance is already running (started $([math]::Round($lockAge.TotalMinutes, 1)) mins ago). Exiting."
        Add-Content -Path $LogFile -Value $msg
        exit
    }
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

    $Url = "https://bordomavi-ai.vercel.app/api/cron/sync-news?secret=$CronSecret"
    $msgStart = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] Requesting: $Url"
    Add-Content -Path $LogFile -Value $msgStart

    # 1. Öncelik: Doğrudan DNS resolve destekli curl (Windows DNS takılmalarına karşı %100 korumalı)
    $curlOutput = & curl.exe -s --max-time 50 --resolve bordomavi-ai.vercel.app:443:64.29.17.3 "$Url"
    if ($curlOutput -and $curlOutput.Contains('"success":true')) {
        $msgSuccess = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SUCCESS] $curlOutput"
        Add-Content -Path $LogFile -Value $msgSuccess
    } else {
        # 2. Yedek: Standart Invoke-RestMethod
        $Response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 45 -ErrorAction Stop
        $ResponseJson = $Response | ConvertTo-Json -Depth 5 -Compress
        $msgSuccess = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SUCCESS] $ResponseJson"
        Add-Content -Path $LogFile -Value $msgSuccess
    }
} catch {
    $msgError = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ERROR] $($_.Exception.Message)"
    Add-Content -Path $LogFile -Value $msgError
} finally {
    if (Test-Path $LockFile) {
        Remove-Item -Path $LockFile -Force
    }
}
