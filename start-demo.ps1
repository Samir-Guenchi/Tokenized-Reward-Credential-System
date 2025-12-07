# TRCS Platform - Demo Startup Script
# =====================================
# This script starts all services needed for the demo
# Run this in PowerShell with: .\start-demo.ps1

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 TRCS PLATFORM - DEMO STARTUP" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Function to wait for a port to become available
function Wait-ForPort {
    param([int]$Port, [int]$Timeout = 30)
    $elapsed = 0
    while (-not (Test-Port -Port $Port) -and $elapsed -lt $Timeout) {
        Start-Sleep -Seconds 1
        $elapsed++
        Write-Host "." -NoNewline
    }
    Write-Host ""
    return Test-Port -Port $Port
}

# Step 1: Kill any existing processes
Write-Host "[1/5] Cleaning up existing processes..." -ForegroundColor Yellow
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  ✓ Cleanup complete" -ForegroundColor Green
Write-Host ""

# Step 2: Start Hardhat Node
Write-Host "[2/5] Starting Hardhat local blockchain..." -ForegroundColor Yellow
$hardhatJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npx hardhat node
} -ArgumentList $ProjectRoot

Write-Host "  Waiting for Hardhat node to start (port 8545)..." -NoNewline
if (Wait-ForPort -Port 8545 -Timeout 30) {
    Write-Host "  ✓ Hardhat node running on http://127.0.0.1:8545" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to start Hardhat node" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Deploy Contracts
Write-Host "[3/5] Deploying smart contracts..." -ForegroundColor Yellow
Set-Location $ProjectRoot
$deployOutput = npx hardhat run scripts/deploy.ts --network localhost 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Contracts deployed successfully" -ForegroundColor Green
} else {
    Write-Host "  ✗ Contract deployment failed" -ForegroundColor Red
    Write-Host $deployOutput
    exit 1
}
Write-Host ""

# Step 4: Start Backend
Write-Host "[4/5] Starting backend API server..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $BackendDir

Write-Host "  Waiting for backend to start (port 3001)..." -NoNewline
if (Wait-ForPort -Port 3001 -Timeout 30) {
    Write-Host "  ✓ Backend API running on http://localhost:3001" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to start backend" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Start Frontend
Write-Host "[5/5] Starting frontend development server..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev
} -ArgumentList $FrontendDir

Write-Host "  Waiting for frontend to start (port 3000)..." -NoNewline
if (Wait-ForPort -Port 3000 -Timeout 30) {
    Write-Host "  ✓ Frontend running on http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to start frontend" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Summary
Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ ALL SERVICES STARTED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Services:" -ForegroundColor White
Write-Host "  • Hardhat Node:  http://127.0.0.1:8545  (Chain ID: 31337)" -ForegroundColor Cyan
Write-Host "  • Backend API:   http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "  • Frontend:      http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor White
Write-Host "  1. Run the demo script:" -ForegroundColor Yellow
Write-Host "     npx hardhat run scripts/demo.ts --network localhost" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Open the frontend in your browser:" -ForegroundColor Yellow
Write-Host "     http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Connect MetaMask with these settings:" -ForegroundColor Yellow
Write-Host "     Network: Hardhat Local" -ForegroundColor Gray
Write-Host "     RPC URL: http://127.0.0.1:8545" -ForegroundColor Gray
Write-Host "     Chain ID: 31337" -ForegroundColor Gray
Write-Host ""
Write-Host "  Test Private Keys (import in MetaMask):" -ForegroundColor Yellow
Write-Host "     Account #0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" -ForegroundColor Gray
Write-Host "     Account #1: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" -ForegroundColor Gray
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Magenta
Write-Host ""

# Keep script running and show logs
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Gray
Write-Host "  LIVE LOGS (Press Ctrl+C to stop)" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════════════════" -ForegroundColor Gray

try {
    while ($true) {
        # Check if jobs are still running
        $jobs = @($hardhatJob, $backendJob, $frontendJob)
        foreach ($job in $jobs) {
            if ($job.State -eq "Failed") {
                Write-Host "A service has failed. Stopping..." -ForegroundColor Red
                break
            }
        }
        Start-Sleep -Seconds 5
    }
} finally {
    # Cleanup on exit
    Write-Host ""
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Stop-Job -Job $hardhatJob, $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $hardhatJob, $backendJob, $frontendJob -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Write-Host "All services stopped." -ForegroundColor Green
}
