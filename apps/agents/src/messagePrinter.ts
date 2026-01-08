import { SDKAssistantMessage, SDKAuthStatusMessage, SDKMessage, SDKPartialAssistantMessage, SDKResultMessage, SDKSystemMessage, SDKToolProgressMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export function printClaudeMessage(message: SDKMessage) {
  //  "assistant" | "user" | "result" | "system" | "stream_event" | "tool_progress" | "auth_status"
  switch (message.type) {
    case 'assistant':
      printAssistantMessage(message as SDKAssistantMessage);
      break;
    case 'user':
      printUserMessage(message as SDKUserMessage);
      break;
    case 'result':
      printResultMessage(message as SDKResultMessage);
      break;
    case 'system': 
      printSystemMessage(message as SDKSystemMessage);
      break;
    case 'stream_event':
      printStreamEvent(message as SDKPartialAssistantMessage);
      break;
    case 'tool_progress':
      printToolProgress(message as SDKToolProgressMessage);
      break;
    case 'auth_status':
      printAuthStatus(message as SDKAuthStatusMessage);
      break;
    default:
      console.warn('unknown message type', message);
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
  if(message.is_error) {
    console.error(`Claude errored: ${message.result}`);
  }
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