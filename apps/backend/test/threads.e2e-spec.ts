import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import {
  ensureTestUser,
  getAuthCookies,
  TEST_USER_SLUG,
} from './helpers/auth.helper';
import cookieParser from 'cookie-parser';

describe('Threads E2E Tests - Parent Task ID', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let actorId: string;

  // Store IDs created during tests
  let parentTaskId: string;
  let threadId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as the main application
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new ProblemDetailsFilter());
    app.setGlobalPrefix('api/v1');

    await app.init();
    httpServer = app.getHttpServer();

    // Setup authentication - MUST be done sequentially
    actorId = await ensureTestUser(app);
    authCookies = await getAuthCookies(httpServer);
  }, 30000); // Increase timeout for app initialization

  afterAll(async () => {
    await app.close();
  });

  describe('Thread Creation Validation', () => {
    beforeAll(async () => {
      // Create a parent task for use in tests
      const response = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Parent Task for Thread Tests',
          description: 'This task will be used as parent for thread tests',
        })
        .expect(201);

      parentTaskId = response.body.id;
    });

    it('should create a thread successfully with valid parent task ID', async () => {
      const response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Test Thread',
          parentTaskId: parentTaskId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Thread');
      expect(response.body.parentTaskId).toBe(parentTaskId);
      expect(response.body.createdByActor.slug).toBe(TEST_USER_SLUG);

      threadId = response.body.id;
    });

    it('should fail to create thread without parentTaskId (400 Bad Request)', async () => {
      const response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Thread Without Parent Task',
          // parentTaskId is missing
        })
        .expect(400);

      expect(response.body).toHaveProperty('title', 'Validation failed');
      expect(response.body).toHaveProperty('status', 400);
      // Validation errors return generic message - the required field validation happened
      expect(response.body.detail).toContain('One or more fields are invalid');
    });

    it('should fail to create thread with invalid UUID format for parentTaskId (400 Bad Request)', async () => {
      const response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Thread With Invalid Parent Task ID',
          parentTaskId: 'not-a-valid-uuid',
        })
        .expect(400);

      expect(response.body).toHaveProperty('title', 'Validation failed');
      expect(response.body).toHaveProperty('status', 400);
      // Validation errors return generic message - the UUID validation happened
      expect(response.body.detail).toContain('One or more fields are invalid');
    });

    it('should fail to create thread with non-existent parent task ID (404 Not Found)', async () => {
      const nonExistentTaskId = '00000000-0000-0000-0000-000000000000';

      const response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Thread With Non-Existent Parent Task',
          parentTaskId: nonExistentTaskId,
        })
        .expect(404);

      expect(response.body).toHaveProperty('status', 404);
      expect(response.body.detail).toContain('Task');
    });
  });

  describe('Parent Task Deletion Validation', () => {
    let isolatedParentTaskId: string;
    let isolatedThreadId: string;

    beforeAll(async () => {
      // Create a dedicated parent task for deletion tests
      const taskResponse = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Deletion Test Parent Task',
          description: 'Task for testing parent task deletion validation',
        })
        .expect(201);

      isolatedParentTaskId = taskResponse.body.id;

      // Create a thread with this parent task
      const threadResponse = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Deletion Test Thread',
          parentTaskId: isolatedParentTaskId,
        })
        .expect(201);

      isolatedThreadId = threadResponse.body.id;
    });

    it('should fail to delete parent task when thread exists (business logic validation)', async () => {
      // The requirement states: "Attempting to delete a task that is the parent of a thread must fail with an appropriate error"
      // This is enforced at the business logic level (not just DB FK constraint)
      // TasksService.deleteTask checks if task is a thread parent before allowing deletion

      const response = await request(httpServer)
        .delete(`/api/v1/tasks/tasks/${isolatedParentTaskId}`)
        .set('Cookie', authCookies)
        .expect(400); // Bad Request due to business rule violation

      expect(response.body).toHaveProperty('status', 400);
      expect(response.body.detail).toContain('Cannot delete task');
      expect(response.body.detail).toContain('parent');
      expect(response.body.detail).toContain('thread');
    });

    it('should be able to delete task after thread is deleted', async () => {
      // First, delete the thread
      await request(httpServer)
        .delete(`/api/v1/threads/${isolatedThreadId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Now the parent task should be deletable since no threads reference it
      await request(httpServer)
        .delete(`/api/v1/tasks/tasks/${isolatedParentTaskId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Verify the task is deleted (soft delete)
      await request(httpServer)
        .get(`/api/v1/tasks/tasks/${isolatedParentTaskId}`)
        .set('Cookie', authCookies)
        .expect(404);
    });
  });

  describe('Thread Retrieval with Parent Task ID', () => {
    let retrievalTaskId: string;
    let retrievalThreadId: string;

    beforeAll(async () => {
      // Create task and thread for retrieval tests
      const taskResponse = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Retrieval Test Parent Task',
          description: 'Task for testing thread retrieval',
        })
        .expect(201);

      retrievalTaskId = taskResponse.body.id;

      const threadResponse = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Retrieval Test Thread',
          parentTaskId: retrievalTaskId,
        })
        .expect(201);

      retrievalThreadId = threadResponse.body.id;
    });

    it('should return thread with correct parentTaskId when retrieving by ID', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/threads/${retrievalThreadId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.id).toBe(retrievalThreadId);
      expect(response.body.parentTaskId).toBe(retrievalTaskId);
      expect(response.body.parentTaskId).not.toBeNull();
      expect(response.body.parentTaskId).not.toBeUndefined();
    });

    it('should list threads (lightweight endpoint without parentTaskId)', async () => {
      // Note: The list endpoint returns a lightweight response (ThreadListItemResponseDto)
      // with only id and title. The full thread details including parentTaskId are
      // available through the getThread endpoint.

      const response = await request(httpServer)
        .get('/api/v1/threads')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toBeInstanceOf(Array);

      // Find our test thread in the list
      const testThread = response.body.items.find(
        (t: any) => t.id === retrievalThreadId,
      );

      expect(testThread).toBeDefined();
      expect(testThread.id).toBe(retrievalThreadId);
      expect(testThread.title).toBe('Retrieval Test Thread');
      // parentTaskId is not included in list response (only in full thread response)
    });
  });

  describe('Thread Operations Preserve Parent Task ID', () => {
    let preservationTaskId: string;
    let preservationThreadId: string;
    let additionalTaskId: string;

    beforeAll(async () => {
      // Create parent task
      const taskResponse = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Preservation Test Parent Task',
          description: 'Task for testing parent task ID preservation',
        })
        .expect(201);

      preservationTaskId = taskResponse.body.id;

      // Create thread
      const threadResponse = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Preservation Test Thread',
          parentTaskId: preservationTaskId,
        })
        .expect(201);

      preservationThreadId = threadResponse.body.id;

      // Create additional task to attach later
      const additionalTaskResponse = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Additional Task',
          description: 'Task to be attached to thread',
        })
        .expect(201);

      additionalTaskId = additionalTaskResponse.body.id;
    });

    it('should preserve parentTaskId when updating thread title', async () => {
      const response = await request(httpServer)
        .patch(`/api/v1/threads/${preservationThreadId}`)
        .set('Cookie', authCookies)
        .send({
          title: 'Updated Thread Title',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Thread Title');
      expect(response.body.parentTaskId).toBe(preservationTaskId);
    });

    it('should preserve parentTaskId when attaching additional tasks', async () => {
      const response = await request(httpServer)
        .post(`/api/v1/threads/${preservationThreadId}/tasks`)
        .set('Cookie', authCookies)
        .send({
          taskId: additionalTaskId,
        })
        .expect(201);

      expect(response.body.parentTaskId).toBe(preservationTaskId);
      expect(response.body.tasks.length).toBeGreaterThanOrEqual(2);

      // Verify parent task is still in the tasks array
      const hasParentTask = response.body.tasks.some(
        (task: any) => task.id === preservationTaskId,
      );
      expect(hasParentTask).toBe(true);
    });
  });

  describe('Multiple Threads with Same Parent Task', () => {
    let sharedParentTaskId: string;
    let thread1Id: string;
    let thread2Id: string;

    it('should allow multiple threads to share the same parent task', async () => {
      // Create shared parent task
      const taskResponse = await request(httpServer)
        .post('/api/v1/tasks/tasks')
        .set('Cookie', authCookies)
        .send({
          name: 'Shared Parent Task',
          description: 'Task shared by multiple threads',
        })
        .expect(201);

      sharedParentTaskId = taskResponse.body.id;

      // Create first thread
      const thread1Response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'First Thread with Shared Parent',
          parentTaskId: sharedParentTaskId,
        })
        .expect(201);

      thread1Id = thread1Response.body.id;
      expect(thread1Response.body.parentTaskId).toBe(sharedParentTaskId);

      // Create second thread with same parent task
      const thread2Response = await request(httpServer)
        .post('/api/v1/threads')
        .set('Cookie', authCookies)
        .send({
          title: 'Second Thread with Shared Parent',
          parentTaskId: sharedParentTaskId,
        })
        .expect(201);

      thread2Id = thread2Response.body.id;
      expect(thread2Response.body.parentTaskId).toBe(sharedParentTaskId);

      // Verify both threads have the same parent
      expect(thread1Id).not.toBe(thread2Id);
      expect(thread1Response.body.parentTaskId).toBe(
        thread2Response.body.parentTaskId,
      );
    });
  });
});
