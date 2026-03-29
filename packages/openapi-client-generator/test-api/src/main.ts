import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { writeFileSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Test API')
    .setDescription('API for testing OpenAPI client generator')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Write OpenAPI spec to file
  writeFileSync('test-api/openapi.json', JSON.stringify(document, null, 2));
  console.log('OpenAPI spec written to test-api/openapi.json');

  SwaggerModule.setup('api', app, document);

  await app.listen(3456);
  console.log('Test API running on http://localhost:3456');
  console.log('OpenAPI UI: http://localhost:3456/api');
}

bootstrap();
