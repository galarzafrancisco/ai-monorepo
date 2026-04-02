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

    // Test 13: Primitives controller - string formats
    console.log('\n✓ Test 13: Primitives - string formats');
    const stringFormats = await client.primitives.PrimitivesController_getStringFormats({ signal: undefined });
    console.log(`  Date field exists: ${!!stringFormats.dateField}`);

    // Test 14: Parameters - path params
    console.log('\n✓ Test 14: Parameters - single path param');
    const pathParam = await client.parameters.ParametersController_singlePathParam({ id: 'test-123', signal: undefined });
    console.log(`  ID: ${pathParam.id}`);

    // Test 15: Parameters - deeply nested paths
    console.log('\n✓ Test 15: Parameters - deeply nested resource paths');
    const nestedPath = await client.parameters.ParametersController_deeplyNestedPath({
      orgId: 'org-1',
      projectId: 'proj-2',
      taskId: 'task-3',
      signal: undefined,
    });
    console.log(`  Nested IDs: ${nestedPath.orgId}/${nestedPath.projectId}/${nestedPath.taskId}`);

    // Test 16: Parameters - enum query param
    console.log('\n✓ Test 16: Parameters - enum query param');
    const enumQuery = await client.parameters.ParametersController_enumQuery({
      sortOrder: 'asc',
      signal: undefined,
    });
    console.log(`  Sort order: ${enumQuery.sortOrder}`);

    // Test 17: Parameters - array query params
    console.log('\n✓ Test 17: Parameters - array query params');
    const arrayQuery = await client.parameters.ParametersController_arrayQuery({
      tags: ['tag1', 'tag2'],
      ids: [1, 2, 3],
      signal: undefined,
    });
    console.log(`  Tags: ${arrayQuery.tags.join(', ')}, IDs: ${arrayQuery.ids.join(', ')}`);

    // Test 18: Parameters - pagination
    console.log('\n✓ Test 18: Parameters - pagination params');
    const pagination = await client.parameters.ParametersController_paginationQuery({
      signal: undefined,
    });
    console.log(`  Page: ${pagination.page}, Limit: ${pagination.limit}`);

    // Test 19: Parameters - custom headers
    console.log('\n✓ Test 19: Parameters - custom headers');
    const headerParams = await client.parameters.ParametersController_headerParams({
      'x-request-id': 'req-456',
      'x-api-version': 'v2',
      signal: undefined,
    });
    console.log(`  Request ID: ${headerParams.requestId}, API Version: ${headerParams.apiVersion}`);

    // Test 20: Parameters - no params endpoint
    console.log('\n✓ Test 20: Parameters - no params');
    const noParams = await client.parameters.ParametersController_noParams({ signal: undefined });
    console.log(`  Message: ${noParams.message}`);

    // Test 21: Parameters - DELETE with JSON confirmation
    console.log('\n✓ Test 21: Parameters - DELETE with JSON confirmation');
    const deleteConfirm = await client.parameters.ParametersController_deleteWithConfirmation({
      id: 'delete-123',
      signal: undefined,
    });
    console.log(`  Deleted: ${deleteConfirm.deleted}, Message: ${deleteConfirm.message}`);

    // Test 22: Responses - 201 Created
    console.log('\n✓ Test 22: Responses - 201 Created');
    const created = await client.responses.ResponsesController_response201({ signal: undefined });
    console.log(`  Created resource ID: ${created.id}`);

    // Test 23: Responses - 204 No Content
    console.log('\n✓ Test 23: Responses - 204 No Content');
    await client.responses.ResponsesController_response204({ signal: undefined });
    console.log('  No content response received');

    // Test 24: Responses - JSON array
    console.log('\n✓ Test 24: Responses - JSON array');
    const jsonArray = await client.responses.ResponsesController_jsonArray({ signal: undefined });
    console.log(`  Array length: ${jsonArray.length}`);

    // Test 25: Responses - text/plain
    console.log('\n✓ Test 25: Responses - text/plain');
    const textPlain = await client.responses.ResponsesController_textPlain({ signal: undefined });
    console.log(`  Plain text response received`);

    // Test 26: Pagination - offset-based
    console.log('\n✓ Test 26: Pagination - offset-based');
    const offsetPagination = await client.pagination.PaginationController_offsetPagination({
      offset: 0,
      limit: 10,
      signal: undefined,
    });
    console.log(`  Offset pagination: ${offsetPagination.items?.length} items`);

    // Test 27: Polymorphism - allOf (inheritance)
    console.log('\n✓ Test 27: Polymorphism - allOf inheritance');
    const allOf = await client.polymorphism.PolymorphismController_getExtendedEntity({ signal: undefined });
    console.log(`  Extended entity with base fields`);

    // Test 28: Polymorphism - events list
    console.log('\n✓ Test 28: Polymorphism - event list');
    const eventsList = await client.polymorphism.PolymorphismController_getEventsList({ signal: undefined });
    console.log(`  Events: ${eventsList.events?.length} events`);

    // Test 29: Parameters - cookie params
    console.log('\n✓ Test 29: Parameters - cookie params endpoint');
    const cookieParams = await client.parameters.ParametersController_cookieParams({ signal: undefined });
    console.log(`  Cookie message: ${cookieParams.message}`);

    // Test 30: Parameters - HEAD endpoint
    console.log('\n✓ Test 30: Parameters - HEAD endpoint');
    await client.parameters.ParametersController_headCheck({ signal: undefined });
    console.log('  HEAD request completed');

    // Test 31: Parameters - OPTIONS endpoint
    console.log('\n✓ Test 31: Parameters - OPTIONS endpoint');
    await client.parameters.ParametersController_optionsCheck({ signal: undefined });
    console.log('  OPTIONS request completed');

    // Test 32: Bodies - nested/array/primitive body variants
    console.log('\n✓ Test 32: Bodies - representative body variants');
    const nestedBody = await client.bodies.BodiesController_nestedBody({
      body: {
        name: 'Nested User',
        address: {
          street: '123 Main St',
          city: 'Lima',
          country: 'PE',
          postalCode: '15001',
        },
        phoneNumbers: ['+51-999-111-222'],
      },
      signal: undefined,
    });
    const arrayBody = await client.bodies.BodiesController_jsonArray({
      body: [
        { id: 'item-1', name: 'Keyboard', quantity: 1 },
        { id: 'item-2', name: 'Mouse', quantity: 2 },
      ],
      signal: undefined,
    });
    console.log(`  Nested name: ${nestedBody.name}, items: ${arrayBody.length}`);

    // Test 33: Files - uploads and downloads
    console.log('\n✓ Test 33: Files - representative upload/download endpoints');
    const uploadedFile = await client.files.FilesController_uploadSingleFile({
      body: { file: 'mock-file-content' },
      signal: undefined,
    });
    const uploadWithMetadata = await client.files.FilesController_uploadFileWithMetadata({
      body: {
        file: 'mock-file-binary',
        title: 'SDK test file',
        description: 'Uploaded from generated client test',
        tags: ['sdk', 'openapi'],
      },
      signal: undefined,
    });
    const fileInfo = await client.files.FilesController_getFileInfo({
      filename: 'sample.bin',
      signal: undefined,
    });
    const downloadedText = await client.files.FilesController_downloadTextFile({
      filename: 'sample.txt',
      signal: undefined,
    });
    console.log(`  Upload: ${uploadedFile.filename}, metadata title: ${uploadWithMetadata.title}, info: ${fileInfo.filename}, text length: ${String(downloadedText).length}`);

    // Test 34: Edge-cases - naming and recursion endpoints
    console.log('\n✓ Test 34: Edge-cases - naming/circular endpoints');
    const version2 = await client.edgeCases.EdgeCasesController_testVersion2({ signal: undefined });
    const acronyms = await client.edgeCases.EdgeCasesController_testAcronyms({ signal: undefined });
    const treeNode = await client.edgeCases.EdgeCasesController_testTreeNode({ signal: undefined });
    const collision = await client.edgeCases.EdgeCasesController_testCollision({ signal: undefined });
    console.log(
      `  version2: ${version2.nameV2}, acronym key: ${acronyms.apiKey}, root tree: ${treeNode.name}, collision: ${collision.username}`
    );

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();
