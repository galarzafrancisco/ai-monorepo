#!/bin/bash

TASK_ID=$1
COMMENTER_NAME=$2
COMMENT_TEXT=$3

if [ -z "$TASK_ID" ] || [ -z "$COMMENTER_NAME" ] || [ -z "$COMMENT_TEXT" ]; then
    echo "Usage: $0 <task_id> <commenter_name> <comment_text>"
    exit 1
fi

body="{
    \"content\": \"$COMMENT_TEXT\",
    \"commenterName\": \"$COMMENTER_NAME\"
}"

# POST 
curl -s -X POST "http://localhost:9999/api/v1/taskeroo/tasks/$TASK_ID/comments" \
     -H "Content-Type: application/json" \
     -d "$body" | jq .