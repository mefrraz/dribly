# Performance Test - Dribly.pt
# Mede tempos reais de carregamento de paginas do site
#
# Executar: powershell -ExecutionPolicy Bypass -File perf-test.ps1
#           powershell -ExecutionPolicy Bypass -File perf-test.ps1 -Url "https://dribly.pt/clube/fc-gaia/home"

param(
    [string]$Url = "https://dribly.pt",
    [int]$Runs = 3
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PERFORMANCE TEST - Dribly.pt" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "URL: $Url" -ForegroundColor Yellow
Write-Host "Runs: $Runs" -ForegroundColor Yellow
Write-Host ""

$results = @()

for ($run = 1; $run -le $Runs; $run++) {
    Write-Host "--- Run $run ---" -ForegroundColor White
    
    $totalStart = Get-Date
    
    try {
        # 1. Mede TTFB (Time To First Byte)
        $ttfbStart = Get-Date
        $response = Invoke-WebRequest -Uri $Url -TimeoutSec 30 -UseBasicParsing
        $ttfb = [math]::Round(((Get-Date) - $ttfbStart).TotalMilliseconds)
        $html = $response.Content
        
        Write-Host "  TTFB: ${ttfb}ms" -ForegroundColor $(if ($ttfb -lt 500) { "Green" } elseif ($ttfb -lt 1000) { "Yellow" } else { "Red" })
        
        # 2. Conta recursos (JS, CSS, imagens, API calls)
        $jsFiles = ([regex]::Matches($html, 'src="([^"]+\.js)"')).Count
        $cssFiles = ([regex]::Matches($html, 'href="([^"]+\.css)"')).Count
        $totalSize = [math]::Round($response.RawContentLength / 1024)
        
        Write-Host "  HTML: ${totalSize}KB | JS: ${jsFiles} | CSS: ${cssFiles}" -ForegroundColor DarkGray
        
        # 3. Simula carregamento do bundle principal (o JS que faz a app funcionar)
        $jsMatch = [regex]::Match($html, 'src="(/assets/index-[^"]+\.js)"')
        if ($jsMatch.Success) {
            $jsUrl = $jsMatch.Groups[1].Value
            if ($jsUrl -notmatch "^https?://") {
                $jsUrl = "https://dribly.pt" + $jsUrl
            }
            
            $jsStart = Get-Date
            try {
                $jsResponse = Invoke-WebRequest -Uri $jsUrl -TimeoutSec 30 -UseBasicParsing
                $jsTime = [math]::Round(((Get-Date) - $jsStart).TotalMilliseconds)
                $jsSize = [math]::Round($jsResponse.RawContentLength / 1024)
                Write-Host "  Bundle JS: ${jsTime}ms (${jsSize}KB)" -ForegroundColor DarkGray
            } catch {
                Write-Host "  Bundle JS: FAILED - $($_.Exception.Message)" -ForegroundColor Red
            }
        }
        
        # 4. Simula chamada Supabase (aproximada - batemos na API REST)
        $sbStart = Get-Date
        try {
            $sbResponse = Invoke-WebRequest -Uri "https://jbnflgxmfjbdjveqpyet.supabase.co/rest/v1/games_2025_2026?select=count" `
                -Headers @{ 
                    "apikey" = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpibmZsZ3htZmpiZGp2ZXFweWV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc5NjA3MjAsImV4cCI6MjA1MzUzNjcyMH0.gUQH4GHqG5lwY6k-YyIFpWNPN6ObSV-d_0aBSp2wddM"
                } -TimeoutSec 15 -UseBasicParsing
            $sbTime = [math]::Round(((Get-Date) - $sbStart).TotalMilliseconds)
            Write-Host "  Supabase (ping): ${sbTime}ms" -ForegroundColor $(if ($sbTime -lt 300) { "Green" } else { "Yellow" })
        } catch {
            $sbTime = [math]::Round(((Get-Date) - $sbStart).TotalMilliseconds)
            Write-Host "  Supabase (ping): FAILED (${sbTime}ms) - $($_.Exception.Message)" -ForegroundColor Red
        }
        
        # 5. Simula chamada FPB via Vercel Edge
        $fpbStart = Get-Date
        try {
            $fpbResponse = Invoke-WebRequest -Uri "https://dribly.pt/api/fpb?page=calendario&clube=119&epoca=2025/2026" `
                -TimeoutSec 15 -UseBasicParsing -MaximumRedirection 0 -ErrorAction SilentlyContinue
            $fpbTime = [math]::Round(((Get-Date) - $fpbStart).TotalMilliseconds)
            
            if ($fpbResponse.StatusCode -eq 200) {
                $fpbSize = [math]::Round($fpbResponse.RawContentLength / 1024)
                Write-Host "  FPB proxy: ${fpbTime}ms (${fpbSize}KB)" -ForegroundColor $(if ($fpbTime -lt 500) { "Green" } elseif ($fpbTime -lt 1500) { "Yellow" } else { "Red" })
            } else {
                Write-Host "  FPB proxy: $($fpbResponse.StatusCode) - ${fpbTime}ms" -ForegroundColor Yellow
            }
        } catch [System.Net.WebException] {
            $fpbTime = [math]::Round(((Get-Date) - $fpbStart).TotalMilliseconds)
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
                Write-Host "  FPB proxy: ${statusCode} - ${fpbTime}ms (edge cold start?)" -ForegroundColor Yellow
            } else {
                Write-Host "  FPB proxy: timeout/error - ${fpbTime}ms" -ForegroundColor Red
            }
        } catch {
            $fpbTime = [math]::Round(((Get-Date) - $fpbStart).TotalMilliseconds)
            Write-Host "  FPB proxy: error - ${fpbTime}ms" -ForegroundColor Red
        }
        
        $total = [math]::Round(((Get-Date) - $totalStart).TotalMilliseconds)
        Write-Host "  Total: ${total}ms" -ForegroundColor White
        
        $results += @{
            Run = $run
            TTFB = $ttfb
            Total = $total
            FPB = $fpbTime
        }
        
    } catch {
        $total = [math]::Round(((Get-Date) - $totalStart).TotalMilliseconds)
        Write-Host "  ERROR: $($_.Exception.Message) (${total}ms)" -ForegroundColor Red
    }
    
    if ($run -lt $Runs) {
        Write-Host ""
        Start-Sleep -Seconds 1
    }
}

# Resumo
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESUMO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($results.Count -gt 0) {
    $avgTTFB = [math]::Round(($results | Measure-Object -Property TTFB -Average).Average)
    $avgTotal = [math]::Round(($results | Measure-Object -Property Total -Average).Average)
    $avgFPB = [math]::Round(($results | Measure-Object -Property FPB -Average).Average)
    
    Write-Host "Media TTFB:     ${avgTTFB}ms" -ForegroundColor White
    Write-Host "Media FPB proxy: ${avgFPB}ms" -ForegroundColor White
    Write-Host "Media Total:     ${avgTotal}ms" -ForegroundColor White
    Write-Host ""
    
    # Diagnostico
    if ($avgFPB -gt 1000) {
        Write-Host "[!] FPB proxy esta lento (>1s). A edge function pode estar com cold start." -ForegroundColor Yellow
        Write-Host "    Solucao: aumentar s-maxage cache ou usar cron job para manter warm." -ForegroundColor Yellow
    }
    if ($avgTTFB -gt 500) {
        Write-Host "[!] TTFB alto (>500ms). A Vercel pode estar a fazer cold start da SPA." -ForegroundColor Yellow
    }
    if ($avgFPB -lt 500 -and $avgTTFB -lt 500) {
        Write-Host "[OK] Performance dentro do esperado." -ForegroundColor Green
        Write-Host "     Os 3 segundos no browser podem ser DOMParser + React render." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Para testar uma pagina especifica:" -ForegroundColor DarkGray
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/perf-test.ps1 -Url https://dribly.pt/clube/seu-clube/home -Runs 5" -ForegroundColor DarkGray
Write-Host ""
