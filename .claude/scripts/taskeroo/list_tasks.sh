#!/bin/bash

# List tasks and show name, id and status
curl -s "http://localhost:9999/api/v1/taskeroo/tasks" | jq '.items[] | {name: .name, status: .status, id: .id}'