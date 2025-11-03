#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=====================================${NC}"
echo -e "${YELLOW}  Taskeroo E2E Test Suite Runner   ${NC}"
echo -e "${YELLOW}=====================================${NC}"
echo

# Check if we need to build
if [ ! -d "apps/backend/dist" ]; then
    echo -e "${YELLOW}Building backend...${NC}"
    npm -w backend run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Build failed!${NC}"
        exit 1
    fi
    echo -e "${GREEN}Build completed successfully${NC}"
    echo
fi

# Run the e2e tests (only Taskeroo tests)
echo -e "${YELLOW}Running Taskeroo E2E tests...${NC}"
cd apps/backend && npx jest --config ./test/jest-e2e.json taskeroo.e2e-spec.ts

# Capture exit code
TEST_EXIT_CODE=$?

echo
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}  All tests passed! ✓${NC}"
    echo -e "${GREEN}=====================================${NC}"
else
    echo -e "${RED}=====================================${NC}"
    echo -e "${RED}  Some tests failed! ✗${NC}"
    echo -e "${RED}=====================================${NC}"
fi

exit $TEST_EXIT_CODE
