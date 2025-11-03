import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ProblemDetailsFilter } from './../src/http/problem-details.filter';

describe('Taskeroo E2E Tests', () => {
  let app: INestApplication<App>;
  let httpServer: App;

  // Store task IDs created during tests
  let taskWithoutAssigneeId: string;
  let taskWithAssigneeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as the main application
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Task Creation', () => {
    it('should create a task without assignee', async () => {
      const response = await request(httpServer)
        .post('/api/v1/taskeroo/tasks')
        .send({
          name: 'Test Task Without Assignee',
          description: 'This is a test task without an assignee',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Task Without Assignee');
      expect(response.body.description).toBe('This is a test task without an assignee');
      // API returns empty string for null assignee
      expect(response.body.assignee).toBeFalsy();
      expect(response.body.status).toBe('NOT_STARTED');

      taskWithoutAssigneeId = response.body.id;
    });

    it('should create a task with assignee', async () => {
      const response = await request(httpServer)
        .post('/api/v1/taskeroo/tasks')
        .send({
          name: 'Test Task With Assignee',
          description: 'This is a test task with an assignee',
          assignee: 'john.doe@example.com',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Task With Assignee');
      expect(response.body.description).toBe('This is a test task with an assignee');
      expect(response.body.assignee).toBe('john.doe@example.com');
      expect(response.body.status).toBe('NOT_STARTED');

      taskWithAssigneeId = response.body.id;
    });
  });

  describe('Task Fetching', () => {
    it('should fetch all tasks and see both created tasks', async () => {
      const response = await request(httpServer)
        .get('/api/v1/taskeroo/tasks')
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.items.length).toBeGreaterThanOrEqual(2);

      const taskIds = response.body.items.map((task: any) => task.id);
      expect(taskIds).toContain(taskWithoutAssigneeId);
      expect(taskIds).toContain(taskWithAssigneeId);
    });

    it('should fetch task by ID and see one task', async () => {
      const response = await request(httpServer)
        .get(`/api/v1/taskeroo/tasks/${taskWithAssigneeId}`)
        .expect(200);

      expect(response.body.id).toBe(taskWithAssigneeId);
      expect(response.body.name).toBe('Test Task With Assignee');
      expect(response.body.assignee).toBe('john.doe@example.com');
    });
  });

  describe('Task Status Changes', () => {
    it('should fail to move task without assignee to In Progress', async () => {
      const response = await request(httpServer)
        .patch(`/api/v1/taskeroo/tasks/${taskWithoutAssigneeId}/status`)
        .send({
          status: 'IN_PROGRESS',
        })
        .expect(400);

      // Verify the error response has proper structure (Problem Details format)
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe(400);
      expect(response.body).toHaveProperty('detail');
      // The error indicates the business rule violation
      expect(response.body.detail.toLowerCase()).toContain('assign');
    });

    it('should successfully move task with assignee to In Progress', async () => {
      const response = await request(httpServer)
        .patch(`/api/v1/taskeroo/tasks/${taskWithAssigneeId}/status`)
        .send({
          status: 'IN_PROGRESS',
        })
        .expect(200);

      expect(response.body.id).toBe(taskWithAssigneeId);
      expect(response.body.status).toBe('IN_PROGRESS');
      expect(response.body.assignee).toBe('john.doe@example.com');
    });
  });

  describe('Task Comments', () => {
    it('should add a comment to a task', async () => {
      const response = await request(httpServer)
        .post(`/api/v1/taskeroo/tasks/${taskWithAssigneeId}/comments`)
        .send({
          commenterName: 'Jane Smith',
          content: 'This is a test comment on the task',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.commenterName).toBe('Jane Smith');
      expect(response.body.content).toBe('This is a test comment on the task');
      expect(response.body.taskId).toBe(taskWithAssigneeId);
    });
  });

  describe('Task Deletion', () => {
    it('should delete the task without comment', async () => {
      // Ensure we have a valid task ID before attempting deletion
      expect(taskWithoutAssigneeId).toBeDefined();

      await request(httpServer)
        .delete(`/api/v1/taskeroo/tasks/${taskWithoutAssigneeId}`)
        .expect(204);
    });

    it('should verify deleted task is gone and commented task exists', async () => {
      // Ensure we have a valid task ID
      expect(taskWithoutAssigneeId).toBeDefined();

      // Verify the deleted task returns 404
      await request(httpServer)
        .get(`/api/v1/taskeroo/tasks/${taskWithoutAssigneeId}`)
        .expect(404);

      // Fetch all tasks
      const allTasksResponse = await request(httpServer)
        .get('/api/v1/taskeroo/tasks')
        .expect(200);

      const taskIds = allTasksResponse.body.items.map((task: any) => task.id);

      // Verify deleted task is not in the list
      expect(taskIds).not.toContain(taskWithoutAssigneeId);

      // Verify task with comment still exists
      expect(taskIds).toContain(taskWithAssigneeId);

      // Verify the task with comment can still be fetched
      const taskWithCommentResponse = await request(httpServer)
        .get(`/api/v1/taskeroo/tasks/${taskWithAssigneeId}`)
        .expect(200);

      expect(taskWithCommentResponse.body.id).toBe(taskWithAssigneeId);
      expect(taskWithCommentResponse.body.name).toBe('Test Task With Assignee');
    });
  });
});
