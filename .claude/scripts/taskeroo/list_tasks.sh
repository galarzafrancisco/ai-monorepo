#!/bin/bash

# List tasks and show name, id and status
curl -s "http://localhost:9999/api/v1/tasks/tasks" | jq '.items[] | {name: .name, status: .status, id: .id}'