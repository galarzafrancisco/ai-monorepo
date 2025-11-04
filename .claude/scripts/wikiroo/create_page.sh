#!/bin/bash

TITLE=$1
AUTHOR=$2
shift 2
CONTENT="$*"

if [ -z "$TITLE" ] || [ -z "$AUTHOR" ] || [ -z "$CONTENT" ]; then
  echo "Usage: $0 <title> <author> <content>"
  exit 1
fi

jq -n \
  --arg title "$TITLE" \
  --arg author "$AUTHOR" \
  --arg content "$CONTENT" \
  '{title: $title, author: $author, content: $content}' \
  | curl -s -X POST "http://localhost:9999/api/v1/wikiroo/pages" \
      -H "Content-Type: application/json" \
      -d @- | jq .
