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

describe('Context Blocks E2E Tests - Nested Block Deletion', () => {
  let app: INestApplication<App>;
  let httpServer: App;
  let authCookies: string;
  let actorId: string;

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

  describe('Nested Block Deletion Validation', () => {
    let parentBlockId: string;
    let childBlockId: string;

    beforeAll(async () => {
      // Create a parent block
      const parentResponse = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Parent Block for Deletion Tests',
          content: 'This block will have children',
        })
        .expect(201);

      parentBlockId = parentResponse.body.id;

      // Create a child block
      const childResponse = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Child Block',
          content: 'This block is a child of the parent',
          parentId: parentBlockId,
        })
        .expect(201);

      childBlockId = childResponse.body.id;
    });

    it('should fail to delete parent block when child blocks exist (409 Conflict)', async () => {
      // Attempting to delete a context block that has children should fail
      // with a proper domain error (not a SQLite constraint error)
      const response = await request(httpServer)
        .delete(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(409); // Conflict status

      // Verify the error response follows the problem details spec
      expect(response.body).toHaveProperty('status', 409);
      expect(response.body).toHaveProperty(
        'type',
        '/errors/context/block-has-children',
      );
      expect(response.body).toHaveProperty('code', 'BLOCK_HAS_CHILDREN');
      expect(response.body).toHaveProperty('title', 'Context block has children');
      expect(response.body.detail).toContain('Cannot delete context block');
      expect(response.body.detail).toContain('1 child block');
    });

    it('should successfully delete parent block after child is deleted', async () => {
      // First, delete the child block
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${childBlockId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Now the parent block should be deletable
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Verify the parent block is deleted (soft delete)
      await request(httpServer)
        .get(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(404);
    });
  });

  describe('Multiple Nested Children Deletion Validation', () => {
    let parentBlockId: string;
    let childBlock1Id: string;
    let childBlock2Id: string;
    let childBlock3Id: string;

    beforeAll(async () => {
      // Create a parent block
      const parentResponse = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Parent Block with Multiple Children',
          content: 'This block will have multiple children',
        })
        .expect(201);

      parentBlockId = parentResponse.body.id;

      // Create three child blocks
      const child1Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Child Block 1',
          content: 'First child',
          parentId: parentBlockId,
        })
        .expect(201);

      childBlock1Id = child1Response.body.id;

      const child2Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Child Block 2',
          content: 'Second child',
          parentId: parentBlockId,
        })
        .expect(201);

      childBlock2Id = child2Response.body.id;

      const child3Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Child Block 3',
          content: 'Third child',
          parentId: parentBlockId,
        })
        .expect(201);

      childBlock3Id = child3Response.body.id;
    });

    it('should fail to delete parent block with multiple children (409 Conflict)', async () => {
      const response = await request(httpServer)
        .delete(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(409);

      expect(response.body).toHaveProperty('status', 409);
      expect(response.body).toHaveProperty(
        'type',
        '/errors/context/block-has-children',
      );
      expect(response.body).toHaveProperty('code', 'BLOCK_HAS_CHILDREN');
      expect(response.body.detail).toContain('Cannot delete context block');
      expect(response.body.detail).toContain('3 child blocks');
    });

    it('should still fail after deleting some but not all children', async () => {
      // Delete one child
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${childBlock1Id}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Should still fail with 2 remaining children
      const response = await request(httpServer)
        .delete(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(409);

      expect(response.body.detail).toContain('2 child blocks');
    });

    it('should succeed after deleting all children', async () => {
      // Delete remaining children
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${childBlock2Id}`)
        .set('Cookie', authCookies)
        .expect(204);

      await request(httpServer)
        .delete(`/api/v1/context/blocks/${childBlock3Id}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Now parent should be deletable
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${parentBlockId}`)
        .set('Cookie', authCookies)
        .expect(204);
    });
  });

  describe('Deeply Nested Block Deletion Validation', () => {
    let level1BlockId: string;
    let level2BlockId: string;
    let level3BlockId: string;

    beforeAll(async () => {
      // Create a deeply nested hierarchy: level1 -> level2 -> level3
      const level1Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Level 1 Block',
          content: 'Top level block',
        })
        .expect(201);

      level1BlockId = level1Response.body.id;

      const level2Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Level 2 Block',
          content: 'Middle level block',
          parentId: level1BlockId,
        })
        .expect(201);

      level2BlockId = level2Response.body.id;

      const level3Response = await request(httpServer)
        .post('/api/v1/context/blocks')
        .set('Cookie', authCookies)
        .send({
          title: 'Level 3 Block',
          content: 'Bottom level block',
          parentId: level2BlockId,
        })
        .expect(201);

      level3BlockId = level3Response.body.id;
    });

    it('should fail to delete level 1 block (has child at level 2)', async () => {
      const response = await request(httpServer)
        .delete(`/api/v1/context/blocks/${level1BlockId}`)
        .set('Cookie', authCookies)
        .expect(409);

      expect(response.body).toHaveProperty(
        'type',
        '/errors/context/block-has-children',
      );
    });

    it('should fail to delete level 2 block (has child at level 3)', async () => {
      const response = await request(httpServer)
        .delete(`/api/v1/context/blocks/${level2BlockId}`)
        .set('Cookie', authCookies)
        .expect(409);

      expect(response.body).toHaveProperty(
        'type',
        '/errors/context/block-has-children',
      );
    });

    it('should successfully delete in bottom-up order', async () => {
      // Delete level 3 (leaf node - should succeed)
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${level3BlockId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Now level 2 should be deletable
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${level2BlockId}`)
        .set('Cookie', authCookies)
        .expect(204);

      // Finally level 1 should be deletable
      await request(httpServer)
        .delete(`/api/v1/context/blocks/${level1BlockId}`)
        .set('Cookie', authCookies)
        .expect(204);
    });
  });
});
