import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('AI Monorepo API')
    .setDescription('The AI Monorepo API description')
    .setVersion('1.0')
    .addTag('ai-monorepo')
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Check if --generate-spec flag is present
  const generateSpec = process.argv.includes('--generate-spec');

  if (generateSpec) {
    // Write OpenAPI spec to file and exit
    const outputPath = join(__dirname, '..', 'contracts', 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log(`OpenAPI specification written to ${outputPath}`);
    process.exit(0);
  }

  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
