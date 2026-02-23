#!/bin/bash

# Screndly Comprehensive Test Runner
# This script runs all tests and generates a detailed report

echo "=================================================="
echo "  SCRENDLY COMPREHENSIVE TEST SUITE"
echo "  Date: $(date)"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Running comprehensive test suite...${NC}"
echo ""

# Run the comprehensive verification test
echo -e "${YELLOW}1. Running Comprehensive Verification Tests${NC}"
npm run test -- tests/comprehensive-verification.test.tsx --reporter=verbose

TEST_RESULT=$?

echo ""
echo "=================================================="
if [ $TEST_RESULT -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
fi
echo "=================================================="
echo ""

# Generate coverage report
echo -e "${YELLOW}2. Generating Coverage Report${NC}"
npm run test -- --coverage --reporter=verbose

echo ""
echo "=================================================="
echo "  TEST EXECUTION COMPLETE"
echo "=================================================="
echo ""
echo -e "${BLUE}Test Summary:${NC}"
echo "  - Comprehensive verification: $([ $TEST_RESULT -eq 0 ] && echo -e "${GREEN}PASSED${NC}" || echo -e "${RED}FAILED${NC}")"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review test results above"
echo "  2. Check coverage/index.html for detailed coverage report"
echo "  3. Fix any failing tests"
echo "  4. Run manual tests from /tests/MANUAL_TEST_CHECKLIST.md"
echo ""

exit $TEST_RESULT
