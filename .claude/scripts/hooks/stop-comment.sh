#!/bin/bash

# This script finds if Claude stopped due to a session limit.
# If so, it adds a comment to the task that Claude was working on.

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/../../.."

TRANSCRIPT_PATH=$1

if [ -z "$TRANSCRIPT_PATH" ]; then
  echo "Usage: $0 <transcript_path>"
  exit 1
fi

# Get the last line of the transcript
LAST_LINE=$(tail -n 1 "$TRANSCRIPT_PATH")

# If it stopped due to a limit reached, there should be a message
# - Message: "Session limit reached ∙ resets 5pm"
# - Path: .message.content[0].text
CLAUDE_MESSAGE=$(echo "$LAST_LINE" | jq -r '.message.content[0].text // empty')

# If there's no such message, exit
if [ -z "$CLAUDE_MESSAGE" ]; then
  exit 0
fi
# If the message does not contain "Session limit reached", exit
if [[ "$CLAUDE_MESSAGE" != *"Session limit reached"* ]]; then
  exit 0
fi

# Load state file to get task info
STATE_FILE="$ROOT_DIR/.ai/state.json"
if [ ! -f "$STATE_FILE" ]; then
  echo "Error: State file not found at $STATE_FILE"
  exit 1
fi

TASK_ID=$(jq -r '.task_id' "$STATE_FILE")
TASK_NAME=$(jq -r '.task_name' "$STATE_FILE")
SESSION_ID=$(jq -r '.session_id' "$STATE_FILE")
COMMENT="Claude stopped due to a session limit: $CLAUDE_MESSAGE\n"
COMMENT+=" - session id: $SESSION_ID\n"
COMMENT+=" - task id: $TASK_ID\n"
COMMENT+=" - task name: $TASK_NAME"
  
# Add comment to the task
$ROOT_DIR/.claude/scripts/taskeroo/comment_task.sh "$TASK_ID" "🤖 Stop hook automation" "$COMMENT"