import { SDKAssistantMessage, SDKAuthStatusMessage, SDKMessage, SDKPartialAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKToolProgressMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export function printClaudeMessage(message: SDKMessage) {
  //  "assistant" | "user" | "result" | "system" | "stream_event" | "tool_progress" | "auth_status"
  switch (message.type) {
    case 'assistant':
      printAssistantMessage(message as SDKAssistantMessage);
    case 'user':
      printUserMessage(message as SDKUserMessage);
    case 'result':
      printResultMessage(message as SDKResultMessage);
    case 'system': 
      printSystemMessage(message as SDKSystemMessage);
    case 'stream_event':
      printStreamEvent(message as SDKPartialAssistantMessage);
    case 'tool_progress':
      printToolProgress(message as SDKToolProgressMessage);
    case 'auth_status':
      printAuthStatus(message as SDKAuthStatusMessage);
  }
}

function printAssistantMessage(message: SDKAssistantMessage) {
  console.log(`assistant message`);
  console.log(message);
}

function printUserMessage(message: SDKUserMessage) {
  console.log(`user message`);
  console.log(message);
}

function printResultMessage(message: SDKResultMessage) {
  console.log(`result message`);
  console.log(message);
}

function printSystemMessage(message: SDKSystemMessage) {
  console.log(`system message`);
  console.log(message);
}

function printStreamEvent(message: SDKPartialAssistantMessage) {
  console.log(`stream event message`);
  console.log(message);
}

function printToolProgress(message: SDKToolProgressMessage) {
  console.log(`tool progress message`);
  console.log(message);
}

function printAuthStatus(message: SDKAuthStatusMessage) {
  console.log(`auth status message`);
  console.log(message);
}