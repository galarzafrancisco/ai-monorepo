#!/bin/bash

TASK_ID=$1

if [ -z "$TASK_ID" ]; then
  echo "Usage: $0 <TASK_ID>"
  exit 1
fi

# List tasks and show name, id and status
curl -s "http://localhost:9999/api/v1/taskeroo/tasks/$TASK_ID" | jq '.'