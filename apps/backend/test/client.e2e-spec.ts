import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CreateClientDto } from '../src/client/dto/create-client.dto';
import { UpdateClientDto } from '../src/client/dto/update-client.dto';

describe('ClientController (e2e)', () => {
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

  it('/clients (POST)', async () => {
    const createClientDto: CreateClientDto = { name: `Test Client ${
      Math.random()
    }` };

    const response = await request(app.getHttpServer())
      .post('/clients')
      .send(createClientDto)
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.name).toEqual(createClientDto.name);
    expect(response.body.id).toBeDefined();
  });

  it('/clients (GET)', async () => {
    // First create a client to ensure the list is not empty
    const createClientDto: CreateClientDto = { name: `Test Client ${
      Math.random()
    }` };
    const createResponse = await request(app.getHttpServer())
      .post('/clients')
      .send(createClientDto)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/clients')
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.clients).toBeInstanceOf(Array);
    expect(response.body.clients.length).toBeGreaterThan(0);
    const createdClient = response.body.clients.find(client => client.id === createResponse.body.id);
    expect(createdClient.name).toEqual(createClientDto.name);
  });

  it('/clients/:id (GET)', async () => {
    const createClientDto: CreateClientDto = { name: `Test Client ${
      Math.random()
    }` };
    const createResponse = await request(app.getHttpServer())
      .post('/clients')
      .send(createClientDto)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/clients/${createResponse.body.id}`)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.name).toEqual(createClientDto.name);
    expect(response.body.id).toEqual(createResponse.body.id);
  });

  it('/clients/:id (PATCH)', async () => {
    const createClientDto: CreateClientDto = { name: `Test Client ${
      Math.random()
    }` };
    const createResponse = await request(app.getHttpServer())
      .post('/clients')
      .send(createClientDto)
      .expect(201);

    const updateClientDto: UpdateClientDto = { name: 'Updated Client Name' };
    const response = await request(app.getHttpServer())
      .patch(`/clients/${createResponse.body.id}`)
      .send(updateClientDto)
      .expect(200);

    expect(response.body).toBeDefined();
    expect(response.body.name).toEqual(updateClientDto.name);
    expect(response.body.id).toEqual(createResponse.body.id);
  });

  it('/clients/:id (DELETE)', async () => {
    const createClientDto: CreateClientDto = { name: `Test Client ${
      Math.random()
    }` };
    const createResponse = await request(app.getHttpServer())
      .post('/clients')
      .send(createClientDto)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/clients/${createResponse.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/clients/${createResponse.body.id}`)
      .expect(404);
  });
});
