import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { CreateServerDto } from '../src/mcp-registry/dto/create-server.dto';
import { CreateScopeDto } from '../src/mcp-registry/dto/create-scope.dto';
import { ProblemDetailsFilter } from '../src/http/problem-details.filter';
import { AppModule } from '../src/app.module';

describe('DiscoveryController (e2e)', () => {
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

  it('should expose authorization server metadata for a registered MCP server version by providedId', async () => {
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
      .send(scopeDto)
      .expect(201);

    const version = 'v1';

    const response = await request(app.getHttpServer())
      .get(
        `/.well-known/oauth-authorization-server/mcp/${serverDto.providedId}/${version}`,
      )
      .expect(200);

    const issuerPattern = /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/;
    expect(response.body.issuer).toMatch(issuerPattern);
    expect(response.body.authorization_endpoint).toBe(
      `${response.body.issuer}/api/v1/authorize/mcp/${serverDto.providedId}/${version}`,
    );
    expect(response.body.token_endpoint).toBe(
      `${response.body.issuer}/api/v1/token/mcp/${serverDto.providedId}/${version}`,
    );
    expect(response.body.registration_endpoint).toBe(
      `${response.body.issuer}/api/v1/register/mcp/${serverDto.providedId}/${version}`,
    );
    expect(response.body.scopes_supported).toEqual(['tool:read']);
    expect(response.body.response_types_supported).toEqual(['code']);
    expect(response.body.grant_types_supported).toEqual([
      'authorization_code',
      'refresh_token',
    ]);
    expect(response.body.token_endpoint_auth_methods_supported).toEqual([
      'client_secret_basic',
      'private_key_jwt',
    ]);
    expect(response.body.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('should return 404 when requesting metadata for a non-existent MCP server', async () => {
    const missingId = 'non-existent-server';

    const response = await request(app.getHttpServer())
      .get(
        `/.well-known/oauth-authorization-server/mcp/${missingId}/v9`,
      )
      .expect(404);

    expect(response.body).toMatchObject({
      error: 'not_found',
      error_description: "Unknown MCP server 'non-existent-server' version 'v9'.",
    });
  });
});
