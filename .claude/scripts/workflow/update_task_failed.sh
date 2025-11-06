#!/bin/bash

set -e

TASK_ID=$1
ASSIGNEE=$2
COMMENTS=$3


if [ -z "$TASK_ID" ] || [ -z "$ASSIGNEE" ] || [ -z "$COMMENTS" ]; then
    echo "Usage: $0 <task_id> <assignee_name> <comments>"
    exit 1
fi

# Mark as IN_PROGRESS"
../taskeroo/change_task_status.sh "$TASK_ID" "IN_PROGRESS"

# Add comment
../taskeroo/comment_task.sh "$TASK_ID" "$ASSIGNEE" "$COMMENT"