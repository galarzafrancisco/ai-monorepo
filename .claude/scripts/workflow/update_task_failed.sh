#!/bin/bash

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TASK_ID=$1
ASSIGNEE=$2
COMMENTS=$3


if [ -z "$TASK_ID" ] || [ -z "$ASSIGNEE" ] || [ -z "$COMMENTS" ]; then
    echo "Usage: $0 <task_id> <assignee_name> <comments>"
    exit 1
fi

# Mark as FAILED
"$SCRIPT_DIR/../taskeroo/change_task_status.sh" "$TASK_ID" "FAILED"

# Add comment
"$SCRIPT_DIR/../taskeroo/comment_task.sh" "$TASK_ID" "$ASSIGNEE" "$COMMENTS"