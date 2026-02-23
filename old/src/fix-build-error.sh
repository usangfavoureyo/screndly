#!/bin/bash

# Fix WebAssembly Compilation Error
# This script clears Vite's build cache and restarts the dev server

echo "🔧 Fixing WebAssembly compilation error..."
echo ""

# Step 1: Clear Vite cache
echo "📁 Clearing Vite cache..."
rm -rf .vite
rm -rf dist
echo "✅ Cache cleared"
echo ""

# Step 2: Clear node_modules/.vite (if exists)
if [ -d "node_modules/.vite" ]; then
    echo "📁 Clearing node_modules/.vite..."
    rm -rf node_modules/.vite
    echo "✅ Cleared"
    echo ""
fi

# Step 3: Reinstall dependencies (optional, uncomment if needed)
# echo "📦 Reinstalling dependencies..."
# rm -rf node_modules
# npm install
# echo "✅ Dependencies reinstalled"
# echo ""

echo "✅ Build cache cleared!"
echo ""
echo "🚀 Next steps:"
echo "   1. Run: npm run dev"
echo "   2. Wait for server to start"
echo "   3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo ""
echo "If error persists, run: rm -rf node_modules && npm install"
