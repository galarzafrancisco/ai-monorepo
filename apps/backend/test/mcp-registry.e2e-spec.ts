import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateServerDto } from '../src/mcp-registry/dto/create-server.dto';
import { CreateScopeDto } from '../src/mcp-registry/dto/create-scope.dto';
import { CreateConnectionDto } from '../src/mcp-registry/dto/create-connection.dto';
import { CreateMappingDto } from '../src/mcp-registry/dto/create-mapping.dto';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';
import cookieParser from 'cookie-parser';

describe('MCP Registry (e2e)', () => {
  let app: INestApplication;
  let authCookies: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global filters and pipes like in main.ts
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

    // Setup authentication
    await ensureTestUser(app);
    authCookies = await getAuthCookies(app.getHttpServer());
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Server Management', () => {
    it('should create an MCP server', async () => {
      const dto: CreateServerDto = {
        providedId: `test-server-${Math.random()}`,
        name: 'Test MCP Server',
        description: 'A test MCP server for e2e testing',
      };

      const response = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.providedId).toBe(dto.providedId);
      expect(response.body.name).toBe(dto.name);
      expect(response.body.description).toBe(dto.description);
    });

    it('should reject duplicate server providedId', async () => {
      const dto: CreateServerDto = {
        providedId: `unique-server-${Math.random()}`,
        name: 'Unique Server',
        description: 'Test server',
      };

      await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(dto)
        .expect(409);
    });

    it('should list servers with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/mcp/servers?page=1&limit=10')
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it('should retrieve server by UUID', async () => {
      const createDto: CreateServerDto = {
        providedId: `server-by-uuid-${Math.random()}`,
        name: 'Server By UUID',
        description: 'Test',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(createDto)
        .expect(201);

      const serverId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${serverId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.id).toBe(serverId);
      expect(response.body.providedId).toBe(createDto.providedId);
    });

    it('should retrieve server by providedId', async () => {
      const createDto: CreateServerDto = {
        providedId: `server-by-provided-${Math.random()}`,
        name: 'Server By Provided ID',
        description: 'Test',
      };

      await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(createDto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${createDto.providedId}`)
        .expect(200);

      expect(response.body.providedId).toBe(createDto.providedId);
    });
  });

  describe('Scope Management', () => {
    let serverId: string;

    beforeEach(async () => {
      const serverDto: CreateServerDto = {
        providedId: `scope-test-server-${Math.random()}`,
        name: 'Scope Test Server',
        description: 'Test',
      };

      const response = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(serverDto)
        .expect(201);

      serverId = response.body.id;
    });

    it('should create a single scope', async () => {
      const dto: CreateScopeDto = {
        scopeId: 'tool:read',
        description: 'Read access to tools',
      };

      const response = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      expect(response.body.scopeId).toBe(dto.scopeId);
      expect(response.body.description).toBe(dto.description);
      expect(response.body.serverId).toBe(serverId);
    });

    it('should create multiple scopes', async () => {
      const dtos: CreateScopeDto[] = [
        { scopeId: 'tool:read', description: 'Read tools' },
        { scopeId: 'tool:write', description: 'Write tools' },
        { scopeId: 'data:read', description: 'Read data' },
      ];

      const response = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dtos)
        .expect(201);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body).toHaveLength(3);
    });

    it('should list scopes for a server', async () => {
      const dto: CreateScopeDto = {
        scopeId: 'test:scope',
        description: 'Test scope',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should get a specific scope', async () => {
      const dto: CreateScopeDto = {
        scopeId: 'specific:scope',
        description: 'Specific scope',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${serverId}/scopes/${dto.scopeId}`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body.scopeId).toBe(dto.scopeId);
    });

    it('should reject duplicate scope for same server', async () => {
      const dto: CreateScopeDto = {
        scopeId: 'duplicate:scope',
        description: 'Duplicate scope',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(409);
    });
  });

  describe('Connection Management', () => {
    let serverId: string;

    beforeEach(async () => {
      const serverDto: CreateServerDto = {
        providedId: `connection-test-server-${Math.random()}`,
        name: 'Connection Test Server',
        description: 'Test',
      };

      const response = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(serverDto)
        .expect(201);

      serverId = response.body.id;
    });

    it('should create an OAuth connection', async () => {
      const dto: CreateConnectionDto = {
        friendlyName: 'GitHub OAuth',
        clientId: 'github_client_123',
        clientSecret: 'secret_abc',
        authorizeUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
      };

      const response = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.friendlyName).toBe(dto.friendlyName);
      expect(response.body.clientId).toBe(dto.clientId);
    });

    it('should list connections for a server', async () => {
      const dto: CreateConnectionDto = {
        friendlyName: 'Test Connection',
        clientId: 'test_client',
        clientSecret: 'test_secret',
        authorizeUrl: 'https://example.com/auth',
        tokenUrl: 'https://example.com/token',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should reject duplicate connection friendly name per server', async () => {
      const dto: CreateConnectionDto = {
        friendlyName: 'Duplicate Connection',
        clientId: 'client1',
        clientSecret: 'secret1',
        authorizeUrl: 'https://example.com/auth',
        tokenUrl: 'https://example.com/token',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(409);
    });
  });

  describe('Mapping Management', () => {
    let serverId: string;
    let scopeId: string;
    let connectionId: string;

    beforeEach(async () => {
      // Create server
      const serverDto: CreateServerDto = {
        providedId: `mapping-test-server-${Math.random()}`,
        name: 'Mapping Test Server',
        description: 'Test',
      };

      const serverResponse = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(serverDto)
        .expect(201);

      serverId = serverResponse.body.id;

      // Create scope
      const scopeDto: CreateScopeDto = {
        scopeId: 'tool:execute',
        description: 'Execute tools',
      };

      const scopeResponse = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(scopeDto)
        .expect(201);

      scopeId = scopeResponse.body.scopeId;

      // Create connection
      const connectionDto: CreateConnectionDto = {
        friendlyName: 'Mapping Test Connection',
        clientId: 'test_client',
        clientSecret: 'test_secret',
        authorizeUrl: 'https://example.com/auth',
        tokenUrl: 'https://example.com/token',
      };

      const connectionResponse = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(connectionDto)
        .expect(201);

      connectionId = connectionResponse.body.id;
    });

    it('should create a scope mapping', async () => {
      const dto: CreateMappingDto = {
        scopeId: scopeId,
        connectionId: connectionId,
        downstreamScope: 'repo:write',
      };

      const response = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/mappings`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.scopeId).toBe(dto.scopeId);
      expect(response.body.connectionId).toBe(dto.connectionId);
      expect(response.body.downstreamScope).toBe(dto.downstreamScope);
    });

    it('should list mappings for a scope', async () => {
      const dto: CreateMappingDto = {
        scopeId: scopeId,
        connectionId: connectionId,
        downstreamScope: 'test:scope',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/mappings`)
        .set('Cookie', authCookies)
        .send(dto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/mcp/servers/${serverId}/scopes/${scopeId}/mappings`)
        .set('Cookie', authCookies)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Deletion with Dependencies', () => {
    it('should prevent deleting server with scopes', async () => {
      const serverDto: CreateServerDto = {
        providedId: `delete-test-${Math.random()}`,
        name: 'Delete Test Server',
        description: 'Test',
      };

      const serverResponse = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(serverDto)
        .expect(201);

      const serverId = serverResponse.body.id;

      const scopeDto: CreateScopeDto = {
        scopeId: 'test:scope',
        description: 'Test scope',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(scopeDto)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/mcp/servers/${serverId}`)
        .set('Cookie', authCookies)
        .expect(409);
    });

    it('should prevent deleting scope with mappings', async () => {
      const serverDto: CreateServerDto = {
        providedId: `scope-delete-test-${Math.random()}`,
        name: 'Scope Delete Test',
        description: 'Test',
      };

      const serverResponse = await request(app.getHttpServer())
        .post('/mcp/servers')
        .set('Cookie', authCookies)
        .send(serverDto)
        .expect(201);

      const serverId = serverResponse.body.id;

      const scopeDto: CreateScopeDto = {
        scopeId: 'deletable:scope',
        description: 'Test',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/scopes`)
        .set('Cookie', authCookies)
        .send(scopeDto)
        .expect(201);

      const connectionDto: CreateConnectionDto = {
        friendlyName: 'Delete Test Connection',
        clientId: 'test',
        clientSecret: 'test',
        authorizeUrl: 'https://example.com/auth',
        tokenUrl: 'https://example.com/token',
      };

      const connectionResponse = await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/connections`)
        .set('Cookie', authCookies)
        .send(connectionDto)
        .expect(201);

      const mappingDto: CreateMappingDto = {
        scopeId: scopeDto.scopeId,
        connectionId: connectionResponse.body.id,
        downstreamScope: 'test',
      };

      await request(app.getHttpServer())
        .post(`/mcp/servers/${serverId}/mappings`)
        .set('Cookie', authCookies)
        .send(mappingDto)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/mcp/servers/${serverId}/scopes/${scopeDto.scopeId}`)
        .set('Cookie', authCookies)
        .expect(409);
    });
  });
});
