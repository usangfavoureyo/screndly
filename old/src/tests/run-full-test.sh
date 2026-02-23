#!/bin/bash

###############################################################################
# Screndly PWA - Full Application Test Runner
# 
# This script runs comprehensive tests across the entire application
###############################################################################

echo "🚀 Starting Screndly PWA Full Test Suite..."
echo "============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "${BLUE}📋 Test Categories:${NC}"
echo "1. Component Rendering"
echo "2. Input Focus Styling (#292929)"
echo "3. Sonner Toast Imports"
echo "4. Dual-Bucket Backblaze B2"
echo "5. Video Studio SEO Captions"
echo "6. Navigation & Routing"
echo "7. Context Providers"
echo "8. Form Interactions"
echo "9. Theme Switching"
echo "10. Accessibility"
echo "11. PWA Features"
echo "12. Brand Consistency"
echo "13. Performance"
echo "14. Error Handling"
echo "15. Data Validation"
echo "16. Responsive Design"
echo "17. FFmpeg Integration"
echo "18. State Management"
echo "19. API Integration"
echo "20. Security"
echo ""

# Run the comprehensive test suite
echo -e "${YELLOW}🧪 Running Comprehensive Test Suite...${NC}"
npm run test -- tests/full-app-test-suite.test.tsx --run --reporter=verbose

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Comprehensive tests passed${NC}"
  ((PASSED_TESTS++))
else
  echo -e "${RED}❌ Comprehensive tests failed${NC}"
  ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

echo ""

# Run integration tests
echo -e "${YELLOW}🔗 Running Integration Tests...${NC}"
npm run test -- tests/integration-test.test.tsx --run --reporter=verbose

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Integration tests passed${NC}"
  ((PASSED_TESTS++))
else
  echo -e "${RED}❌ Integration tests failed${NC}"
  ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

echo ""

# Run existing test suites
echo -e "${YELLOW}📦 Running Existing Test Suites...${NC}"
npm run test -- --run --reporter=verbose

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Existing tests passed${NC}"
  ((PASSED_TESTS++))
else
  echo -e "${RED}❌ Some existing tests failed${NC}"
  ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

echo ""
echo "============================================="
echo -e "${BLUE}📊 Test Summary${NC}"
echo "============================================="
echo "Total Test Categories: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✨ All tests passed! Your app is ready.${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠️  Some tests need attention.${NC}"
  exit 1
fi
