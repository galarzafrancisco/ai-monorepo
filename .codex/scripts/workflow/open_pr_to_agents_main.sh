#!/bin/bash

# Script: open_pr_to_agents_main.sh
# Purpose: Opens a pull request to agents/main branch
# Usage: ./open_pr_to_agents_main.sh "PR Title" "PR Body"
#
# Constraints handled:
# - Fails if uncommitted changes exist
# - Handles branch not existing in remote (pushes with --set-upstream)
# - Skips rebase (lets GitHub handle merge conflicts)
# - Clear error messages for all failure scenarios

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

# Validate arguments
if [ $# -ne 2 ]; then
    error "Missing required arguments.\nUsage: $0 \"PR Title\" \"PR Body\""
fi

PR_TITLE="$1"
PR_BODY="$2"

# Validate we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a git repository. Please run this script from within your git project."
fi

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ -z "$CURRENT_BRANCH" ]; then
    error "Unable to determine current branch. You might be in detached HEAD state."
fi

info "Current branch: $CURRENT_BRANCH"

# Validate not on agents/main
if [ "$CURRENT_BRANCH" = "agents/main" ]; then
    error "You are currently on 'agents/main'. Please create a feature branch first.\nExample: git checkout -b feature/my-feature"
fi

# Check for uncommitted changes
GIT_STATUS=$(git status --porcelain)
if [ -n "$GIT_STATUS" ]; then
    error "Git working directory is not clean. Please commit or stash your changes before opening a PR.\n\nUncommitted changes:\n$GIT_STATUS"
fi

# Fetch latest from origin
info "Fetching latest from origin..."
if ! git fetch origin; then
    error "Failed to fetch from origin. Check your network connection and repository access."
fi

# Check if agents/main exists remotely
if ! git rev-parse --verify origin/agents/main > /dev/null 2>&1; then
    error "Remote branch 'origin/agents/main' does not exist. Cannot create PR to non-existent target branch."
fi

# Push current branch to remote
info "Pushing branch '$CURRENT_BRANCH' to remote..."
if git rev-parse --verify "origin/$CURRENT_BRANCH" > /dev/null 2>&1; then
    # Branch exists in remote, just push
    if ! git push origin "$CURRENT_BRANCH"; then
        error "Failed to push branch to remote. You may need to pull changes first or resolve conflicts."
    fi
else
    # Branch doesn't exist in remote, push with --set-upstream
    if ! git push --set-upstream origin "$CURRENT_BRANCH"; then
        error "Failed to push new branch to remote. Check your repository permissions."
    fi
fi

success "Branch pushed successfully!"

# Create PR using gh CLI
info "Creating pull request..."
if ! command -v gh &> /dev/null; then
    error "GitHub CLI (gh) is not installed. Install it from: https://cli.github.com/"
fi

if ! PR_URL=$(gh pr create --base agents/main --head "$CURRENT_BRANCH" --title "$PR_TITLE" --body "$PR_BODY" 2>&1); then
    error "Failed to create pull request.\n$PR_URL"
fi

success "✓ Pull request created successfully!"
echo ""
echo "PR URL: $PR_URL"
echo "Target: agents/main ← $CURRENT_BRANCH"
echo ""
info "Next steps:"
echo "  1. Monitor CI/CD checks on GitHub"
echo "  2. Request reviews if needed"
echo "  3. Address any merge conflicts in the GitHub UI if they arise"
