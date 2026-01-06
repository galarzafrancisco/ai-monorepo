import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env.config';


async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cookie parser for session management
  app.use(cookieParser());

  // Enable CORS with credentials
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe with transformation and strict validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter for RFC 7807 Problem Details
  app.useGlobalFilters(new ProblemDetailsFilter());

  // Set global prefix for API routes
  app.setGlobalPrefix('api/v1', {
    exclude: [
      {
        path: '/.well-known/*path', method: RequestMethod.ALL
      }],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Monorepo API')
    .setDescription('The AI Monorepo API description')
    .setVersion('1.0')
    .addTag('ai-monorepo')
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

  // Check if --generate-spec flag is present
  const generateSpec = process.argv.includes('--generate-spec');

  if (generateSpec) {
    // Write OpenAPI spec to file and exit
    const outputPath = join(__dirname, '..', 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log(`OpenAPI specification written to ${outputPath}`);
    process.exit(0);
  }

  SwaggerModule.setup('api/v1/docs', app, document);

  // Serve static files from the UI build (in production)
  // __dirname is dist/apps/backend/src, so we need to go up to dist/public
  const staticPath = join(__dirname, '..', '..', '..', 'public');
  const betaStaticPath = join(__dirname, '..', '..', '..', 'public/beta');  // new UI build
  if (existsSync(staticPath)) {
    app.useStaticAssets(staticPath);
    console.log(`Serving static files from ${staticPath}`);

    // SPA fallback: serve index.html for all non-API, non-asset routes
    // This allows client-side routing to work
    app.use((req, res, next) => {
      // Don't intercept API routes, static assets, or well-known routes
      if (req.path.startsWith('/api/') || req.path.startsWith('/assets/') || req.path.startsWith('/.well-known/')) {
        return next();
      }
      // Serve Beta
      if (req.path.startsWith('/beta')) {
        res.sendFile(join(betaStaticPath, 'index.html'));
      }
      // Serve index.html for all other routes
      res.sendFile(join(staticPath, 'index.html'));
    });
  }

  const config = getConfig();
  await app.listen(config.port);
  console.log(`Application is running on: http://localhost:${config.port}`);
}
bootstrap();