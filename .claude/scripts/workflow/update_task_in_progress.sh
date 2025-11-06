#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TASK_ID=$1
ASSIGNEE=$2
SESSION_ID=$3


if [ -z "$TASK_ID" ] || [ -z "$ASSIGNEE" ] || [ -z "$SESSION_ID" ]; then
    echo "Usage: $0 <task_id> <assignee_name> <session_id>"
    exit 1
fi

# Assign task to self
"$SCRIPT_DIR/../taskeroo/assign_task.sh" "$TASK_ID" "$ASSIGNEE" "$SESSION_ID"

# Mark as IN_PROGRESS
"$SCRIPT_DIR/../taskeroo/change_task_status.sh" "$TASK_ID" "IN_PROGRESS"

# Add comment
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMMENT="Starting to work on this. I've created the branch $BRANCH"
"$SCRIPT_DIR/../taskeroo/comment_task.sh" "$TASK_ID" "$ASSIGNEE" "$COMMENT"