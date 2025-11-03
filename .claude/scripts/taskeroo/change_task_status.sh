#!/bin/bash

TASK_ID=$1
STATUS=$2


if [ -z "$TASK_ID" ] || [ -z "$STATUS" ]; then
    echo "Usage: $0 <task_id> <new_status>"
    exit 1
fi

body="{
    \"status\": \"$STATUS\"
}"

# PATCH
curl -s -X PATCH "http://localhost:9999/api/v1/taskeroo/tasks/$TASK_ID/status" \
     -H "Content-Type: application/json" \
     -d "$body" | jq .