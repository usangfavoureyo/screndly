@echo off
REM Screndly - WebAssembly Cache Fix Script (Windows)
REM Fixes: "WebAssembly compilation aborted: Network error"
REM This is a known Vite build cache issue with WASM modules

echo.
echo ============================================
echo   Screndly WebAssembly Cache Fix (Windows)
echo ============================================
echo.

REM Step 1: Clear Vite cache directory
echo Step 1: Clearing .vite cache...
if exist ".vite" (
    rmdir /s /q ".vite"
    echo ✓ Cleared .vite directory
) else (
    echo ℹ No .vite directory found (already clean)
)
echo.

REM Step 2: Clear node_modules Vite cache
echo Step 2: Clearing node_modules\.vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo ✓ Cleared node_modules\.vite directory
) else (
    echo ℹ No node_modules\.vite directory found (already clean)
)
echo.

REM Step 3: Clear dist directory
echo Step 3: Clearing dist directory...
if exist "dist" (
    rmdir /s /q "dist"
    echo ✓ Cleared dist directory
) else (
    echo ℹ No dist directory found (already clean)
)
echo.

REM Step 4: Browser cache instructions
echo ============================================
echo   Step 4: Clear Browser Cache
echo ============================================
echo.
echo Please perform a HARD REFRESH in your browser:
echo.
echo   Chrome/Edge: Ctrl + Shift + R
echo   Firefox:     Ctrl + F5
echo.
echo ============================================
echo.

REM Step 5: Restart instructions
echo ============================================
echo   Step 5: Restart Dev Server
echo ============================================
echo.
echo Now restart your dev server:
echo.
echo   npm run dev
echo.
echo ============================================
echo.

echo ✓ Cache cleanup complete!
echo.
echo If the error persists after hard refresh:
echo   1. Close all browser tabs with the app
echo   2. Clear browser cache completely (Settings → Privacy)
echo   3. Restart browser
echo   4. Try again
echo.
pause
