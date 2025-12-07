@echo off
title TRCS Demo Runner
cd /d "%~dp0"

echo.
echo ============================================
echo   TRCS Full Demo Script
echo ============================================
echo.

:: Wait for node
echo Waiting for blockchain node...
timeout /t 3 /nobreak > nul

:: Deploy contracts
echo.
echo [1/3] Deploying smart contracts...
call npx hardhat run scripts/deploy.ts --network localhost
if errorlevel 1 (
    echo.
    echo ERROR: Deployment failed! Make sure you ran start-node.bat first.
    echo.
    pause
    exit /b 1
)

:: Run demo
echo.
echo [2/3] Running demo script...
call npx hardhat run scripts/demo-full.ts --network localhost

:: Start backend
echo.
echo [3/3] Starting backend server...
cd backend
start "TRCS Backend" cmd /k "npm run dev"
cd ..

:: Start frontend
echo.
echo Starting frontend...
cd frontend
start "TRCS Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ============================================
echo   Demo Complete!
echo ============================================
echo.
echo Services running:
echo   - Blockchain: http://127.0.0.1:8545
echo   - Backend:    http://127.0.0.1:3001
echo   - Frontend:   http://localhost:3000
echo.
echo Open http://localhost:3000 in your browser!
echo.
pause
