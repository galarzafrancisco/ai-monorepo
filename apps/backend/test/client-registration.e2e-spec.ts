import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RegisterClientDto } from '../src/authorization-server/dto/register-client.dto';
import { GrantType, TokenEndpointAuthMethod } from '../src/authorization-server/enums';

describe('ClientRegistrationController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /register', () => {
    it('should successfully register a new MCP client with localhost redirect URI', async () => {
      const registerDto: RegisterClientDto = {
        client_name: `MCP Test Client ${Math.random()}`,
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      const response = await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.client_id).toBeDefined();
      expect(response.body.client_name).toEqual(registerDto.client_name);
      expect(response.body.redirect_uris).toEqual(registerDto.redirect_uris);
      expect(response.body.grant_types).toEqual(registerDto.grant_types);
      expect(response.body.token_endpoint_auth_method).toEqual(
        TokenEndpointAuthMethod.NONE,
      );
      // Client secret should be null for 'none' auth method
      expect(response.body.client_secret).toBeNull();
    });

    it('should successfully register a client with HTTP redirect URI', async () => {
      const registerDto: RegisterClientDto = {
        client_name: `HTTP Test Client ${Math.random()}`,
        redirect_uris: ['http://example.com/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      const response = await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.client_id).toBeDefined();
      expect(response.body.redirect_uris).toEqual(registerDto.redirect_uris);
    });

    it('should successfully register a client with multiple redirect URIs', async () => {
      const registerDto: RegisterClientDto = {
        client_name: `Multi URI Client ${Math.random()}`,
        redirect_uris: [
          'http://localhost:3000/callback',
          'https://app.example.com/callback',
          'http://127.0.0.1:8080/oauth/callback',
        ],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      const response = await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.redirect_uris).toHaveLength(3);
      expect(response.body.redirect_uris).toEqual(registerDto.redirect_uris);
    });

    it('should reject registration without required grant types', async () => {
      const registerDto = {
        client_name: 'Invalid Client',
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE], // Missing refresh_token
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(400);
    });

    it('should reject registration with invalid redirect URI', async () => {
      const registerDto = {
        client_name: 'Invalid URI Client',
        redirect_uris: ['not-a-valid-uri'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(400);
    });

    it('should reject registration without PKCE for authorization_code grant', async () => {
      const registerDto = {
        client_name: 'No PKCE Client',
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        // Missing code_challenge_method
      };

      await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(400);
    });

    it('should reject duplicate client registration', async () => {
      const registerDto: RegisterClientDto = {
        client_name: `Duplicate Client ${Math.random()}`,
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      // First registration should succeed
      await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(201);

      // Second registration with same name should fail
      await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(409);
    });
  });

  describe('GET /register/:client_id', () => {
    it('should retrieve a registered client', async () => {
      const registerDto: RegisterClientDto = {
        client_name: `Retrieve Test Client ${Math.random()}`,
        redirect_uris: ['http://localhost:3000/callback'],
        grant_types: [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
        token_endpoint_auth_method: TokenEndpointAuthMethod.NONE,
        code_challenge_method: 'S256',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/register')
        .send(registerDto)
        .expect(201);

      const clientId = createResponse.body.client_id;

      const response = await request(app.getHttpServer())
        .get(`/register/${clientId}`)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.client_id).toEqual(clientId);
      expect(response.body.client_name).toEqual(registerDto.client_name);
      // Client secret should NOT be returned on retrieval
      expect(response.body.client_secret).toBeUndefined();
    });

    it('should return 404 for non-existent client', async () => {
      await request(app.getHttpServer())
        .get('/register/non-existent-client-id')
        .expect(404);
    });
  });
});
