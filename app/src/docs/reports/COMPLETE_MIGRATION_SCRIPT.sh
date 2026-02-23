#!/bin/bash
# Screndly Documentation Migration Script
# Moves all historical reports from root to /docs/reports/
# Run from project root directory

set -e  # Exit on error

echo "🎬 Screndly Documentation Migration"
echo "===================================="
echo ""

# Define files to move
FILES=(
  "BANDWIDTH_OPTIMIZATION_GUIDE.md"
  "BUG_REPORT_AND_FIXES.md"
  "COMPREHENSIVE_APP_TEST_REPORT_DEC_14.md"
  "COMPREHENSIVE_TEST_COMPLETE.md"
  "DOCUMENTATION_UPDATES_SUMMARY.md"
  "FFMPEG_ERROR_FIX.md"
  "FFMPEG_IMPLEMENTATION.md"
  "FINAL_TEST_REPORT.md"
  "FRONTEND_READINESS_AUDIT.md"
  "HAPTICS_REVIEW_COMPLETE.md"
  "HYBRID_SYSTEM_IMPLEMENTATION.md"
  "IMPLEMENTATION_CHECKLIST.md"
  "IMPLEMENTATION_SUMMARY.md"
  "IMPLEMENTATION_VERIFICATION.md"
  "NOTIFICATION_SWIPE_ACTIONS.md"
  "PERFORMANCE_OPTIMIZATIONS.md"
  "PERFORMANCE_SUMMARY.md"
  "SCRENDLY_APP_STRUCTURE.md"
  "STATE_MANAGEMENT_AUDIT_DEC_14.md"
  "TESTING_COMPLETE.md"
  "TESTING_INDEX.md"
  "TEST_EXECUTION_REPORT.md"
  "TEST_EXECUTION_SUMMARY.md"
  "TEST_REPORT.md"
  "TEST_SUMMARY.md"
)

# Counters
MOVED=0
SKIPPED=0
TOTAL=${#FILES[@]}

echo "📋 Files to migrate: $TOTAL"
echo ""

# Create target directory if it doesn't exist
mkdir -p docs/reports

# Move files
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  📄 Moving: $file"
    mv "$file" "docs/reports/"
    ((MOVED++))
  else
    echo "  ⚠️  Skipped (not found): $file"
    ((SKIPPED++))
  fi
done

echo ""
echo "📊 Migration Complete!"
echo "===================="
echo "  ✅ Moved: $MOVED files"
echo "  ⏭️  Skipped: $SKIPPED files"
echo "  📁 Destination: docs/reports/"
echo ""

# Verification
REPORT_COUNT=$(ls -1 docs/reports/*.md 2>/dev/null | wc -l)
echo "📂 Total files in docs/reports/: $REPORT_COUNT"
echo ""

# List root-level .md files (should be minimal now)
ROOT_MD_COUNT=$(ls -1 *.md 2>/dev/null | wc -l)
echo "📋 Remaining .md files in root: $ROOT_MD_COUNT"
if [ $ROOT_MD_COUNT -gt 0 ]; then
  echo "  Files:"
  ls -1 *.md 2>/dev/null | while read -r file; do
    echo "    • $file"
  done
fi

echo ""
echo "✨ Migration successful!"
echo "   Review the documentation at: docs/INDEX.md"
echo "   Historical reports at: docs/reports/"
echo ""
