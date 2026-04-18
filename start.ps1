# Watch Together - Start Script
# Starts both backend and frontend servers with one command

Write-Host ""
Write-Host "  ▶ Watch Together - Starting..." -ForegroundColor Cyan
Write-Host ""

# Kill any existing node processes to avoid port conflicts
Write-Host "  [1/3] Cleaning up old processes..." -ForegroundColor Yellow
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start Backend
Write-Host "  [2/3] Starting Backend (port 3001)..." -ForegroundColor Green
$backend = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "$PSScriptRoot\backend" -PassThru -WindowStyle Hidden
Write-Host "         Backend PID: $($backend.Id)" -ForegroundColor DarkGray

Start-Sleep -Seconds 2

# Start Frontend
Write-Host "  [3/3] Starting Frontend (port 5173)..." -ForegroundColor Green
$frontend = Start-Process -FilePath "npx" -ArgumentList "vite --host" -WorkingDirectory "$PSScriptRoot\frontend" -PassThru -WindowStyle Hidden
Write-Host "         Frontend PID: $($frontend.Id)" -ForegroundColor DarkGray

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "  ✅ Both servers are running!" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop everything:  Stop-Process -Name node -Force" -ForegroundColor DarkGray
Write-Host ""
