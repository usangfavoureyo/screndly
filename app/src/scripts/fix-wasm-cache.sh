#!/bin/bash

# Screndly - WebAssembly Cache Fix Script
# Fixes: "WebAssembly compilation aborted: Network error"
# This is a known Vite build cache issue with WASM modules

echo "🔧 Screndly WebAssembly Cache Fix"
echo "=================================="
echo ""

# Step 1: Clear Vite cache directory
echo "📁 Step 1: Clearing .vite cache..."
if [ -d ".vite" ]; then
  rm -rf .vite
  echo "✅ Cleared .vite directory"
else
  echo "ℹ️  No .vite directory found (already clean)"
fi
echo ""

# Step 2: Clear node_modules Vite cache
echo "📁 Step 2: Clearing node_modules/.vite cache..."
if [ -d "node_modules/.vite" ]; then
  rm -rf node_modules/.vite
  echo "✅ Cleared node_modules/.vite directory"
else
  echo "ℹ️  No node_modules/.vite directory found (already clean)"
fi
echo ""

# Step 3: Clear dist directory
echo "📁 Step 3: Clearing dist directory..."
if [ -d "dist" ]; then
  rm -rf dist
  echo "✅ Cleared dist directory"
else
  echo "ℹ️  No dist directory found (already clean)"
fi
echo ""

# Step 4: Instructions for browser cache
echo "🌐 Step 4: Clear Browser Cache"
echo "=================================="
echo ""
echo "Please perform a HARD REFRESH in your browser:"
echo ""
echo "  Chrome/Edge (Windows/Linux): Ctrl + Shift + R"
echo "  Chrome/Edge (Mac):           Cmd + Shift + R"
echo "  Firefox (Windows/Linux):     Ctrl + F5"
echo "  Firefox (Mac):               Cmd + Shift + R"
echo "  Safari (Mac):                Cmd + Option + R"
echo ""
echo "=================================="
echo ""

# Step 5: Restart instructions
echo "🚀 Step 5: Restart Dev Server"
echo "=================================="
echo ""
echo "Now restart your dev server:"
echo ""
echo "  npm run dev"
echo ""
echo "=================================="
echo ""

echo "✅ Cache cleanup complete!"
echo ""
echo "If the error persists after hard refresh:"
echo "  1. Close all browser tabs with the app"
echo "  2. Clear browser cache completely (Settings → Privacy)"
echo "  3. Restart browser"
echo "  4. Try again"
echo ""
