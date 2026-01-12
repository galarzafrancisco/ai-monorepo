import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateServerDto } from '../src/mcp-registry/dto/create-server.dto';
import { CreateScopeDto } from '../src/mcp-registry/dto/create-scope.dto';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';

describe('AuthorizationServerMetadataController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
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

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should expose authorization server metadata for a registered MCP server by providedId', async () => {
    const serverDto: CreateServerDto = {
      providedId: `discovery-server-${Math.random()}`,
      name: 'Discovery Test MCP Server',
      description: 'Server used for authorization metadata discovery tests',
    };

    const createServerResponse = await request(app.getHttpServer())
      .post('/mcp/servers')
      .send(serverDto)
      .expect(201);

    const serverId: string = createServerResponse.body.id;

    const scopeDto: CreateScopeDto = {
      scopeId: 'tool:read',
      description: 'Read tool data',
    };

    await request(app.getHttpServer())
      .post(`/mcp/servers/${serverId}/scopes`)
      .send([scopeDto])
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(
        `/.well-known/oauth-authorization-server/mcp/${serverDto.providedId}/1.0.0`,
      )
      .expect(200);

    expect(response.body.issuer).toBeDefined();
    expect(response.body.authorization_endpoint).toBeDefined();
    expect(response.body.token_endpoint).toBeDefined();
    expect(response.body.scopes_supported).toContain('tool:read');
    expect(response.body.response_types_supported).toEqual(['code']);
    expect(response.body.grant_types_supported).toEqual([
      'authorization_code',
      'refresh_token',
    ]);
    expect(response.body.token_endpoint_auth_methods_supported).toBeDefined();
    expect(Array.isArray(response.body.token_endpoint_auth_methods_supported)).toBe(true);
    expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('should return 404 when requesting metadata for a non-existent MCP server', async () => {
    const missingId = 'non-existent-server';

    await request(app.getHttpServer())
      .get(`/.well-known/oauth-authorization-server/mcp/${missingId}/1.0.0`)
      .expect(404);
  });
});
