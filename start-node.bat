@echo off
title TRCS Demo - Blockchain Node
cd /d "%~dp0"

echo ============================================
echo   TRCS Demo - Starting Blockchain
echo ============================================
echo.

:: Start Hardhat node
echo Starting Hardhat blockchain node...
echo.
npx hardhat node
