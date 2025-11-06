#!/bin/bash

set -e

# ----------------------------------
# Input arguments
# ----------------------------------
AGENT_NAME=$1
SESSION_ID=$2
TASK_ID=$3
TASK_NAME=$4

if [ -z "$AGENT_NAME" ] || [ -z "$SESSION_ID" ] || [ -z "$TASK_ID" ] || [ -z "$TASK_NAME" ]; then
  echo "Usage: $0 <AGENT_NAME> <SESSION_ID> <TASK_ID> <TASK_NAME>"
  exit 1
fi
# Task name must be branch-name safe
TASK_NAME_SAFE=$(echo "$TASK_NAME" | tr ' ' '-' | tr -cd '[:alnum:]-')
if [ "$TASK_NAME_SAFE" != "$TASK_NAME" ]; then
  echo "Error: TASK_NAME contains unsafe characters. Use only alphanumeric characters, spaces, and hyphens. Try \"${TASK_NAME_SAFE}\" instead."
  exit 1
fi

# ----------------------------------
# Validate git stauts
# - is clean (no uncommitted changes)
# - is on `agents/main` branch
# ----------------------------------
# Is clean?
GIT_STATUS=$(git status --porcelain)
if [ -n "$GIT_STATUS" ]; then
  echo "Error: Git working directory is not clean. Please commit or stash your changes."
  exit 1
fi
# Checkout agents/main branch if not already on it
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "agents/main" ]; then
  git checkout agents/main
fi
# Cut branch
BRANCH_NAME="{AGENT_NAME}/s/{SESSION_ID}/tasks/{TASK_ID}"
git checkout -b "$BRANCH_NAME"

# ----------------------------------
# Print a message with the new branch name
# ----------------------------------
echo "All good to start working on task '$TASK_NAME'!"
echo "Switched to new branch: $BRANCH_NAME"
echo "You can now start working on your task."