#!/bin/bash

# Script: sync_agents_main_with_main.sh
# Purpose: Sync agents/main with main after merging a release PR
# Usage: ./sync_agents_main_with_main.sh
#
# This should be run AFTER merging agents/main to main
# It ensures agents/main stays in sync to prevent duplicate changes in future PRs

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print error messages
error() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

# Function to print success messages
success() {
    echo -e "${GREEN}$1${NC}"
}

# Function to print info messages
info() {
    echo -e "${YELLOW}$1${NC}"
}

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository. Please run this script from within your git project."
fi

info "Syncing agents/main with main..."

# Check for uncommitted changes
GIT_STATUS=$(git status --porcelain)
if [ -n "$GIT_STATUS" ]; then
    error "Git working directory is not clean. Please commit or stash your changes first.\n\nUncommitted changes:\n$GIT_STATUS"
fi

# Checkout main and pull latest
info "Checking out main branch..."
if ! git checkout main; then
    error "Failed to checkout main branch."
fi

info "Pulling latest from main..."
if ! git pull origin main; then
    error "Failed to pull latest from main. Check your network connection."
fi

# Checkout agents/main
info "Checking out agents/main branch..."
if ! git checkout agents/main; then
    error "Failed to checkout agents/main branch."
fi

# Merge main into agents/main (fast-forward only to ensure clean sync)
info "Merging main into agents/main..."
if ! git merge --ff-only main; then
    error "Fast-forward merge failed. This means agents/main has diverged from main.\nYou may need to manually resolve this or use 'git merge main' instead."
fi

# Push to remote
info "Pushing agents/main to remote..."
if ! git push origin agents/main; then
    error "Failed to push agents/main to remote."
fi

success "✓ Successfully synced agents/main with main!"
echo ""
info "Branch status:"
echo "  - agents/main is now at the same commit as main"
echo "  - Future PRs from agents/main to main will only show new changes"
echo ""
