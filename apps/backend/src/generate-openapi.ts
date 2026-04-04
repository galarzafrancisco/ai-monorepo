import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { NestExpressApplication } from '@nestjs/platform-express';

async function generateOpenApi(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      {
        path: '/.well-known/*path',
        method: RequestMethod.ALL,
      },
    ],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('taico API')
    .setDescription('taico API description')
    .setVersion('1.0')
    .addTag('taico')
    .addCookieAuth(
      'access_token',
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-Cookie',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const outputPath = join(__dirname, '..', 'openapi.json');
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI specification written to ${outputPath}`);

  await app.close();
}

void generateOpenApi();
