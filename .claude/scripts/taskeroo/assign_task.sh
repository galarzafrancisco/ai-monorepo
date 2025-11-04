#!/bin/bash

TASK_ID=$1
ASSIGNEE=$2
SESSION_ID=$3

if [ -z "$TASK_ID" ] || [ -z "$ASSIGNEE" ]; then
    echo "Usage: $0 <task_id> <assignee_name> [session_id]"
    exit 1
fi

if [ -n "$SESSION_ID" ]; then
    body=$(jq -n --arg assignee "$ASSIGNEE" --arg sessionId "$SESSION_ID" '{assignee: $assignee, sessionId: $sessionId}')
else
    body=$(jq -n --arg assignee "$ASSIGNEE" '{assignee: $assignee}')
fi

curl -s -X PATCH "http://localhost:9999/api/v1/taskeroo/tasks/$TASK_ID/assign" \
    -H "Content-Type: application/json" \
    -d "$body" | jq .
