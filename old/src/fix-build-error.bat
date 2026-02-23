@echo off
REM Fix WebAssembly Compilation Error (Windows)
REM This script clears Vite's build cache and restarts the dev server

echo.
echo 🔧 Fixing WebAssembly compilation error...
echo.

REM Step 1: Clear Vite cache
echo 📁 Clearing Vite cache...
if exist .vite rmdir /s /q .vite
if exist dist rmdir /s /q dist
echo ✅ Cache cleared
echo.

REM Step 2: Clear node_modules/.vite (if exists)
if exist node_modules\.vite (
    echo 📁 Clearing node_modules/.vite...
    rmdir /s /q node_modules\.vite
    echo ✅ Cleared
    echo.
)

echo ✅ Build cache cleared!
echo.
echo 🚀 Next steps:
echo    1. Run: npm run dev
echo    2. Wait for server to start
echo    3. Hard refresh browser (Ctrl+Shift+R)
echo.
echo If error persists, run: rmdir /s /q node_modules ^&^& npm install
echo.
pause
