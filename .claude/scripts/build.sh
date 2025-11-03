#!/bin/bash

# Run the build
npm run build

# Capture the exit code
BUILD_EXIT_CODE=$?

# If build failed, exit with code 2 to block Claude from stopping
# This forces Claude to reconsider and fix the build errors
if [ $BUILD_EXIT_CODE -ne 0 ]; then
  echo "Build failed! Claude needs to fix the errors before stopping."
  exit 2
fi

# Build succeeded, allow Claude to stop normally
echo "Build passed successfully!"
exit 0