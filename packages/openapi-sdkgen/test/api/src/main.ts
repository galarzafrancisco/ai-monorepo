import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  console.log('hi')
  const args = process.argv.slice(2);
  const generateSpec = args.includes('--generate-spec');
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Test API')
    .setDescription('API for testing OpenAPI client generator')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  if (generateSpec) {
    // Write OpenAPI spec to file and exit
    const outputPath = join(__dirname, '..', 'openapi.json');
    console.log(`generating spec in ${outputPath}`)
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log('OpenAPI spec written to test-api/openapi.json');
    process.exit(0);
  }
  // Write OpenAPI spec to file

  SwaggerModule.setup('api', app, document);

  await app.listen(3456);
  console.log('Test API running on http://localhost:3456');
  console.log('OpenAPI UI: http://localhost:3456/api');
}

bootstrap();
