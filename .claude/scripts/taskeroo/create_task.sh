#!/bin/bash

NAME=$1
DESCRIPTION=$2

if [ -z "$NAME" ] || [ -z "$DESCRIPTION" ]; then
    echo "Usage: $0 <task_name> <task_description>"
    exit 1
fi

body="{
    \"name\": \"$NAME\",
    \"description\": \"$DESCRIPTION\"
}"

# POST
curl -s -X POST "http://localhost:9999/api/v1/taskeroo/tasks" \
     -H "Content-Type: application/json" \
     -d "$body" | jq .