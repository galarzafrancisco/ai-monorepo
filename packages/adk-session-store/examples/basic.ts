import { LlmAgent, Runner } from '@google/adk';
import { SqliteSessionService } from '../src/index.js';

const agent = new LlmAgent({
  name: 'assistant',
  model: 'gemini-2.5-flash',
  instruction: 'You are helpful.',
});

const sessionService = new SqliteSessionService({ filename: './example.sqlite' });

const runner = new Runner({
  appName: 'example-app',
  agent,
  sessionService,
});

const session = await sessionService.createSession({
  appName: 'example-app',
  userId: 'user-1',
});

console.log('Created session', session.id);
