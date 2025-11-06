#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TASK_ID=$1
ASSIGNEE=$2
PR_LINK=$3


if [ -z "$TASK_ID" ] || [ -z "$ASSIGNEE" ] || [ -z "$PR_LINK" ]; then
    echo "Usage: $0 <task_id> <assignee_name> <pr_link>"
    exit 1
fi

# Mark as FOR_REVIEW
"$SCRIPT_DIR/../taskeroo/change_task_status.sh" "$TASK_ID" "FOR_REVIEW"

# Add comment
COMMENT="Opened PR for review: $PR_LINK"
"$SCRIPT_DIR/../taskeroo/comment_task.sh" "$TASK_ID" "$ASSIGNEE" "$COMMENT"