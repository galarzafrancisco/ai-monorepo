/**
 * Test script that validates the generated SDK
 * Run this against the test-api server
 */

import { ApiClient } from './generated/index.js';

const BASE_URL = 'http://localhost:2000';

const USERS = {
  dev:   { email: 'dev@test.com',   password: 'dev' },
  admin: { email: 'admin@test.com', password: 'admin' },
};

interface Session {
  accessToken: string;
  refreshToken: string;
}

async function login(user: { email: string; password: string }): Promise<Session> {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });

  if (!res.ok) throw new Error(`Login failed for ${user.email}: ${res.status} ${await res.text()}`);

  const parsedCookies = Object.fromEntries(
    res.headers.getSetCookie().map(c => {
      const [nameValue] = c.split(';');
      const [name, value] = nameValue.split('=');
      return [name.trim(), value.trim()];
    })
  );

  if (!parsedCookies.access_token)  throw new Error('No access_token in login response');
  if (!parsedCookies.refresh_token) throw new Error('No refresh_token in login response');

  return { accessToken: parsedCookies.access_token, refreshToken: parsedCookies.refresh_token };
}

async function main() {
  console.log('🧪 Testing Generated SDK\n');

  const [devSession, adminSession] = await Promise.all([login(USERS.dev), login(USERS.admin)]);

  // Two auth mechanics for dev — same JWT, different delivery
  const devCookieClient = new ApiClient({ baseUrl: BASE_URL, getCookies: async () => `access_token=${devSession.accessToken}` });
  const devBearerClient = new ApiClient({ baseUrl: BASE_URL, getAccessToken: async () => devSession.accessToken });
  const adminCookieClient = new ApiClient({ baseUrl: BASE_URL, getCookies: async () => `access_token=${adminSession.accessToken}` });

  try {
    // Test 1: GET all agents — dev user via cookie auth
    console.log('✓ Test 1: GET agents (cookie auth)');
    const agents = await devCookieClient.agent.AgentsController_listAgents();
    console.log(`  Found ${agents.total} agents`);
    agents.items.forEach(agent => {
      console.log(`  - @${agent.slug}`);
    });

    // Test 2: Make a task — dev user via bearer auth
    console.log('✓ Test 2: POST task (bearer auth)');
    const task = await devBearerClient.task.TasksController_createTask({
      body: {
        name: 'test task',
        description: 'this is a test task',
        assigneeActorId: agents.items[0]?.actorId
      }
    });
    console.log(`  Created task ${task.id}`);

    // Test 3: Admin adds a comment — admin user via cookie auth
    console.log('✓ Test 3: POST comment on task (admin, cookie auth)');
    const comment = await adminCookieClient.task.TasksController_addComment({
      id: task.id,
      body: { content: 'Reviewed by admin.' },
    });
    console.log(`  Comment added by ${comment.commenterName}: "${comment.content}"`);

    // Test 4: Admin adds a context block — admin user via cookie auth
    console.log('✓ Test 4: POST block (admin, cookie auth)');
    const block1 = await adminCookieClient.context.ContextController_createBlock({
      body: {
        title: "test block",
        content: "# Hello\n\nThis is a test",
        tagNames: ['foo']
      }
    });
    console.log(`  Block created ${block1.id}`);

    // Test 5: Dev adds a child block
    console.log('✓ Test 5: POST block (dev)');
    const block2 = await devBearerClient.context.ContextController_createBlock({
      body: {
        title: "test block",
        content: "# Hello\n\nThis is a test",
        tagNames: ['foo'],
        parentId: block1.id
      }
    });
    console.log(`  Child block created ${block2.id}`);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
