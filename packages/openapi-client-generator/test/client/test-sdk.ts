/**
 * Test script that validates the generated SDK
 * Run this against the test-api server
 */

import { ApiClient } from './generated/index.js';

async function main() {
  console.log('🧪 Testing Generated SDK\n');

  const client = new ApiClient({
    baseUrl: 'http://localhost:3456',
    getAccessToken: async () => 'test-token-123',
  });

  try {
    // Test 1: GET all users
    console.log('✓ Test 1: GET /users');
    const users = await client.users.UsersController_getUsers({ signal: undefined });
    console.log(`  Found ${users.length} users`);
    console.log(`  First user: ${users[0]?.name}`);

    // Test 2: GET user by ID (path param)
    console.log('\n✓ Test 2: GET /users/:id (path param)');
    const user = await client.users.UsersController_getUserById({ id: '1', signal: undefined });
    console.log(`  User: ${user.name} <${user.email}>`);

    // Test 3: GET with query params
    console.log('\n✓ Test 3: GET /users?limit=1');
    const limitedUsers = await client.users.UsersController_getUsers({
      limit: 1,
      signal: undefined,
    });
    console.log(`  Limited to ${limitedUsers.length} users`);

    // Test 4: POST with body
    console.log('\n✓ Test 4: POST /users (with body)');
    const newUser = await client.users.UsersController_createUser({
      body: {
        name: 'Test User',
        email: 'test@example.com',
        age: 25,
      },
      signal: undefined,
    });
    console.log(`  Created user: ${newUser.name} (ID: ${newUser.id})`);

    // Test 5: PUT to update
    console.log('\n✓ Test 5: PUT /users/:id');
    const updated = await client.users.UsersController_updateUser({
      id: newUser.id,
      body: {
        name: 'Updated Name',
      },
      signal: undefined,
    });
    console.log(`  Updated user name to: ${updated.name}`);

    // Test 6: Nested objects
    console.log('\n✓ Test 6: GET /users/:id/metadata (nested objects)');
    const withMeta = await client.users.UsersController_getUserWithMetadata({
      id: '1',
      signal: undefined,
    });
    console.log(`  User: ${withMeta.user.name}`);
    console.log(`  Metadata tags: ${withMeta.metadata.tags.join(', ')}`);

    // Test 7: Tasks with query filter
    console.log('\n✓ Test 7: GET /tasks?status=pending');
    const tasks = await client.tasks.TasksController_listTasks({
      status: 'pending',
      signal: undefined,
    });
    console.log(`  Found ${tasks.length} pending tasks`);

    // Test 8: PATCH
    console.log('\n✓ Test 8: PATCH /tasks/:id/status');
    const taskUpdated = await client.tasks.TasksController_updateTaskStatus({
      id: '1',
      body: { status: 'in_progress' },
      signal: undefined,
    });
    console.log(`  Task status: ${taskUpdated?.status}`);

    // Test 9: Headers (auth check)
    console.log('\n✓ Test 9: Auth headers');
    const authCheck = await client.users.UsersController_checkAuth({ signal: undefined });
    console.log(`  Auth header received: ${authCheck.auth?.substring(0, 20)}...`);

    // Test 9b: Custom header parameter
    console.log('\n✓ Test 9b: Custom header parameter');
    const customHeaderCheck = await client.users.UsersController_checkCustomHeader({
      'x-request-id': 'test-request-123',
      signal: undefined,
    });
    console.log(`  Custom header received: ${customHeaderCheck.requestId}`);

    // Test 9c: Query parameters with special characters (hyphens)
    console.log('\n✓ Test 9c: Query parameters with special characters');
    const searchResults = await client.users.UsersController_searchAdvanced({
      'page-size': 10,
      'sort-order': 'desc',
      signal: undefined,
    });
    console.log(`  Query params received: page-size=${searchResults.pageSize}, sort-order=${searchResults.sortOrder}`);

    // Test 9d: Optional header parameter with value
    console.log('\n✓ Test 9d: Optional header parameter (with value)');
    const optionalHeaderWithValue = await client.users.UsersController_checkOptionalHeader({
      'x-tracking-id': 'track-456',
      signal: undefined,
    });
    console.log(`  Optional header received: ${optionalHeaderWithValue.trackingId}`);

    // Test 9e: Optional header parameter without value (omitted)
    console.log('\n✓ Test 9e: Optional header parameter (without value)');
    const optionalHeaderWithoutValue = await client.users.UsersController_checkOptionalHeader({
      signal: undefined,
    });
    console.log(`  Optional header received: ${optionalHeaderWithoutValue.trackingId} (should be null)`);

    // Test 10: DELETE (no content response)
    console.log('\n✓ Test 10: DELETE /users/:id');
    await client.users.UsersController_deleteUser({ id: newUser.id, signal: undefined });
    console.log('  User deleted successfully');

    // Test 11: Streaming events
    console.log('\n✓ Test 11: Streaming SSE events');
    let eventCount = 0;
    for await (const event of client.stream.StreamController_streamEvents({
      count: 3,
      signal: undefined,
    })) {
      eventCount++;
      console.log(`  Event ${eventCount}: ${JSON.stringify(event)}`);
    }
    console.log(`  Received ${eventCount} events`);

    // Test 12: AbortSignal support
    console.log('\n✓ Test 12: AbortSignal support');
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    try {
      await client.users.UsersController_getUsers({ signal: controller.signal });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('  Request successfully aborted');
      } else {
        throw error;
      }
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
