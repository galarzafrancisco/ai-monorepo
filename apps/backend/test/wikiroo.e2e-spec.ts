import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { ProblemDetailsFilter } from './../src/http/problem-details.filter';

describe('Wikiroo E2E Tests', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let createdPageId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

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

  it('should create a wiki page', async () => {
    const response = await request(httpServer)
      .post('/api/v1/wikiroo/pages')
      .send({
        title: 'Test Page',
        content: 'This is a wikiroo page created during tests.',
        author: 'Agent Tester',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Test Page',
      content: 'This is a wikiroo page created during tests.',
      author: 'Agent Tester',
    });

    createdPageId = response.body.id;
    expect(createdPageId).toBeDefined();
  });

  it('should list wiki pages without content field', async () => {
    const response = await request(httpServer)
      .get('/api/v1/wikiroo/pages')
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);

    const page = response.body.items.find((item: any) => item.id === createdPageId);
    expect(page).toBeDefined();
    expect(page.content).toBeUndefined();
    expect(page.title).toBe('Test Page');
    expect(page.author).toBe('Agent Tester');
  });

  it('should fetch the wiki page by id including content', async () => {
    const response = await request(httpServer)
      .get(`/api/v1/wikiroo/pages/${createdPageId}`)
      .expect(200);

    expect(response.body.id).toBe(createdPageId);
    expect(response.body.title).toBe('Test Page');
    expect(response.body.content).toBe(
      'This is a wikiroo page created during tests.',
    );
    expect(response.body.author).toBe('Agent Tester');
  });

  it('should reject updates without any fields', async () => {
    await request(httpServer)
      .patch(`/api/v1/wikiroo/pages/${createdPageId}`)
      .send({})
      .expect(400);
  });

  it('should update the wiki page title', async () => {
    const response = await request(httpServer)
      .patch(`/api/v1/wikiroo/pages/${createdPageId}`)
      .send({
        title: 'Updated Test Page',
      })
      .expect(200);

    expect(response.body.title).toBe('Updated Test Page');
    expect(response.body.content).toBe(
      'This is a wikiroo page created during tests.',
    );
  });

  it('should append content to the wiki page', async () => {
    const appendText = '\nAdditional wikiroo details.';
    const response = await request(httpServer)
      .post(`/api/v1/wikiroo/pages/${createdPageId}/append`)
      .send({
        content: appendText,
      })
      .expect(200);

    expect(response.body.content).toContain(appendText.trim());
  });

  it('should delete the wiki page', async () => {
    await request(httpServer)
      .delete(`/api/v1/wikiroo/pages/${createdPageId}`)
      .expect(204);
  });

  it('should return 404 for unknown page', async () => {
    const response = await request(httpServer)
      .get('/api/v1/wikiroo/pages/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(response.body.code).toBe('PAGE_NOT_FOUND');
  });

  it('should return 404 when fetching a deleted page', async () => {
    await request(httpServer)
      .get(`/api/v1/wikiroo/pages/${createdPageId}`)
      .expect(404);
  });
});
