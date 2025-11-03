# Taskeroo End-to-End Test Suite

This document describes the E2E test suite for the Taskeroo application and how to run it.

## Overview

The test suite is built in TypeScript using Jest and Supertest to perform end-to-end testing of the Taskeroo API. It validates all the core functionality of the task management system.

## Test Coverage

The E2E test suite covers the following scenarios:

### Task Creation
- ✅ Create a task without an assignee
- ✅ Create a task with an assignee

### Task Fetching
- ✅ Fetch all tasks and verify both created tasks are present
- ✅ Fetch a specific task by ID

### Task Status Changes
- ✅ Attempt to move a task without assignee to "In Progress" (should fail)
- ✅ Successfully move a task with assignee to "In Progress"

### Task Comments
- ✅ Add a comment to a task

### Task Deletion
- ✅ Delete a task without comments
- ✅ Verify deleted task is no longer accessible
- ✅ Verify non-deleted task with comments still exists

## Running Tests Locally

### Prerequisites

1. Node.js 20 or higher
2. All dependencies installed (`npm install`)

### Option 1: Using npm script (recommended)

From the root of the monorepo:

```bash
npm run test:e2e
```

This will:
1. Build the backend
2. Run all E2E tests

### Option 2: Using the shell script

From the root of the monorepo:

```bash
./run-tests.sh
```

This script provides colored output and better error messaging.

### Option 3: Run only Taskeroo tests

From the `apps/backend` directory:

```bash
npx jest --config ./test/jest-e2e.json taskeroo.e2e-spec.ts
```

### Option 4: Run all E2E tests

From the `apps/backend` directory:

```bash
npm run test:e2e
```

## Test Files

- **Test Suite**: `apps/backend/test/taskeroo.e2e-spec.ts`
- **Jest Config**: `apps/backend/test/jest-e2e.json`
- **TypeScript Config**: `apps/backend/test/tsconfig.e2e.json`

## CI/CD Integration

### GitHub Actions

The test suite runs automatically on every pull request to the `main` branch via GitHub Actions.

**Workflow file**: `.github/workflows/test.yml`

The CI pipeline:
1. Checks out the code
2. Sets up Node.js 20
3. Installs dependencies
4. Builds the backend
5. Runs the E2E tests
6. Builds Docker image (if tests pass)
7. Uploads Docker image as artifact (7 day retention)
8. Uploads test results as artifacts (30 day retention)
9. Shows logs on failure

### Viewing CI Results

1. Go to the "Actions" tab in GitHub
2. Select the workflow run for your PR
3. View the test results in the "Build and Test" job
4. Download artifacts:
   - **Docker image**: `taskeroo-docker-image` (ready to deploy)
   - **Test results**: `test-results` (if tests fail)

## Test Structure

The test suite uses:
- **Jest**: Test runner and assertion library
- **Supertest**: HTTP assertion library for testing NestJS applications
- **TypeScript**: For type safety and IDE support

Each test:
1. Sets up a test application instance with the full NestJS module
2. Applies the same configuration as production (validation pipes, exception filters, etc.)
3. Makes HTTP requests to the API endpoints
4. Validates responses against expected behavior
5. Cleans up after all tests complete

## Database

The tests use the same SQLite database as the application. The database state persists between test runs, so you may see existing data when running tests locally.

For a clean test run, you can delete the database file before running tests:

```bash
rm -f apps/backend/data/database.sqlite
npm run test:e2e
```

## Debugging Tests

### Run tests in watch mode

```bash
cd apps/backend
npx jest --config ./test/jest-e2e.json --watch
```

### Run with verbose output

```bash
cd apps/backend
npx jest --config ./test/jest-e2e.json --verbose
```

### Debug with Node inspector

```bash
cd apps/backend
node --inspect-brk node_modules/.bin/jest --config ./test/jest-e2e.json --runInBand
```

Then attach your debugger (Chrome DevTools or VS Code).

## Troubleshooting

### Tests fail with "database is locked"

This can happen if the backend is running while tests execute. Stop the backend before running tests:

```bash
# Stop any running backend processes
pkill -f "nest start"

# Then run tests
npm run test:e2e
```

### Tests fail with import errors

Make sure the backend is built before running tests:

```bash
npm -w backend run build
npm run test:e2e
```

### TypeScript errors

Ensure your dependencies are up to date:

```bash
npm install
```

## Contributing

When adding new features to Taskeroo:

1. Add corresponding E2E tests to `apps/backend/test/taskeroo.e2e-spec.ts`
2. Run the full test suite locally to ensure nothing breaks
3. Ensure CI passes before merging PRs

## Future Enhancements

Potential improvements to the test suite:

- [ ] Add test database isolation (separate test DB)
- [ ] Add performance/load testing
- [ ] Add WebSocket event testing
- [ ] Add authentication/authorization tests (when implemented)
- [ ] Add test coverage reporting
- [ ] Add mutation testing
