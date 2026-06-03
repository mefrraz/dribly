# Rate Limit Tester - FPB.pt e TugaBasket
# Testa quantos pedidos por segundo cada site aguenta e onde bloqueiam
#
# Executar: powershell -ExecutionPolicy Bypass -File rate-limit-test.ps1
#           powershell -ExecutionPolicy Bypass -File rate-limit-test.ps1 -RequestsPerSecond 10 -TotalRequests 50

param(
    [int]$RequestsPerSecond = 3,
    [int]$TotalRequests = 20
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RATE LIMIT TEST - FPB.pt & TugaBasket" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pedidos: $TotalRequests | Intervalo: $([math]::Round(1000/$RequestsPerSecond))ms entre cada" -ForegroundColor Yellow
Write-Host ""

$headers = @{
    "User-Agent" = "Mozilla/5.0 (compatible; Dribly-RateTest/1.0)"
}

# ═══════════════════════════════════════════
# FPB: Pagina de clubes
# ═══════════════════════════════════════════
Write-Host ">>> FPB.pt - /clubes/ (todos os 250+ clubes)" -ForegroundColor Green
Write-Host ""
$fpbSuccess = 0; $fpbBlocked = 0; $fpbError = 0
$fpbTimes = [System.Collections.ArrayList]::new()

for ($i = 1; $i -le $TotalRequests; $i++) {
    $start = Get-Date
    try {
        $response = Invoke-WebRequest -Uri "https://www.fpb.pt/clubes/" -Headers $headers -TimeoutSec 15 -UseBasicParsing
        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)

        if ($response.StatusCode -eq 200) {
            $fpbSuccess++
            [void]$fpbTimes.Add($elapsed)
            $sizeKB = [math]::Round($response.Content.Length / 1024, 1)
            Write-Host "  [$i] 200 OK - ${elapsed}s - ${sizeKB}KB" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 429) {
            $fpbBlocked++
            Write-Host "  [$i] 429 RATE LIMITED - ${elapsed}s" -ForegroundColor Magenta
            Start-Sleep -Milliseconds 15000
        } else {
            $fpbError++
            Write-Host "  [$i] $($response.StatusCode) - ${elapsed}s" -ForegroundColor Red
        }
    } catch {
        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)
        if ($_.Exception.Response.StatusCode -eq 429) {
            $fpbBlocked++
            Write-Host "  [$i] 429 RATE LIMITED - ${elapsed}s" -ForegroundColor Magenta
            Start-Sleep -Milliseconds 15000
        } elseif ($_.Exception.Response.StatusCode -eq 403) {
            $fpbBlocked++
            Write-Host "  [$i] 403 FORBIDDEN - ${elapsed}s - Cloudflare bloqueou!" -ForegroundColor Red
        } else {
            $fpbError++
            Write-Host "  [$i] ERROR: $($_.Exception.Message) - ${elapsed}s" -ForegroundColor Red
        }
    }
    if ($i -lt $TotalRequests) {
        Start-Sleep -Milliseconds ([math]::Round(1000 / $RequestsPerSecond))
    }
}

Write-Host ""
if ($fpbTimes.Count -gt 0) {
    $avg = [math]::Round(($fpbTimes | Measure-Object -Average).Average, 2)
    $min = [math]::Round(($fpbTimes | Measure-Object -Minimum).Minimum, 2)
    $max = [math]::Round(($fpbTimes | Measure-Object -Maximum).Maximum, 2)
    Write-Host "FPB Resumo: $fpbSuccess OK / $fpbBlocked bloqueados / $fpbError erros" -ForegroundColor White
    Write-Host "FPB Latencia: avg=${avg}s min=${min}s max=${max}s" -ForegroundColor White
} else {
    Write-Host "FPB Resumo: $fpbSuccess OK / $fpbBlocked bloqueados / $fpbError erros" -ForegroundColor Red
}

# ═══════════════════════════════════════════
# TugaBasket
# ═══════════════════════════════════════════
Write-Host ""
Write-Host ">>> TugaBasket - / (pagina principal)" -ForegroundColor Green
Write-Host ""
$tbSuccess = 0; $tbBlocked = 0; $tbError = 0
$tbTimes = [System.Collections.ArrayList]::new()

for ($i = 1; $i -le $TotalRequests; $i++) {
    $start = Get-Date
    try {
        $response = Invoke-WebRequest -Uri "https://www.tugabasket.com/" -TimeoutSec 15 -UseBasicParsing
        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)

        if ($response.StatusCode -eq 200) {
            $tbSuccess++
            [void]$tbTimes.Add($elapsed)
            $sizeKB = [math]::Round($response.Content.Length / 1024, 1)
            Write-Host "  [$i] 200 OK - ${elapsed}s - ${sizeKB}KB" -ForegroundColor Green
        } elseif ($response.StatusCode -eq 429) {
            $tbBlocked++
            Write-Host "  [$i] 429 RATE LIMITED - ${elapsed}s" -ForegroundColor Magenta
            Start-Sleep -Milliseconds 15000
        } else {
            $tbError++
            Write-Host "  [$i] $($response.StatusCode) - ${elapsed}s" -ForegroundColor Red
        }
    } catch {
        $elapsed = [math]::Round(((Get-Date) - $start).TotalSeconds, 2)
        if ($_.Exception.Response.StatusCode -eq 429) {
            $tbBlocked++
            Write-Host "  [$i] 429 RATE LIMITED - ${elapsed}s" -ForegroundColor Magenta
            Start-Sleep -Milliseconds 15000
        } else {
            $tbError++
            Write-Host "  [$i] ERROR: $($_.Exception.Message) - ${elapsed}s" -ForegroundColor Red
        }
    }
    if ($i -lt $TotalRequests) {
        Start-Sleep -Milliseconds ([math]::Round(1000 / $RequestsPerSecond))
    }
}

Write-Host ""
if ($tbTimes.Count -gt 0) {
    $avg = [math]::Round(($tbTimes | Measure-Object -Average).Average, 2)
    Write-Host "TugaBasket Resumo: $tbSuccess OK / $tbBlocked bloqueados / $tbError erros | avg=${avg}s" -ForegroundColor White
} else {
    Write-Host "TugaBasket Resumo: $tbSuccess OK / $tbBlocked bloqueados / $tbError erros" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TESTE CONCLUIDO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Ajusta com: -RequestsPerSecond 10 -TotalRequests 50" -ForegroundColor DarkGray
Write-Host ""
