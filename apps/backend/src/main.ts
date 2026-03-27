#!/usr/bin/env node
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env.config';
import { runWorkerMode } from './worker/worker-mode';

const logger = new Logger('Bootstrap');

async function listenWithFallback(
  app: NestExpressApplication,
  basePort: number,
  maxAttempts: number,
): Promise<number> {
  let port = basePort;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await app.listen(port);
      return port;
    } catch (error) {
      if (!isAddressInUseError(error)) {
        throw error;
      }
      logger.warn(`Port ${port} is in use, trying ${port + 1}.`);
      port += 1;
    }
  }

  throw new Error(
    `Unable to find an open port starting at ${basePort} after ${maxAttempts} attempts.`,
  );
}

function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'EADDRINUSE'
  );
}

async function bootstrap() {
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const generateSpec = args.includes('--generate-spec');
  const serverMode = args.includes('--server');
  const workerMode = args.includes('--worker');

  if (help) {
    printUsage();
    return;
  }

  if (serverMode && workerMode) {
    throw new Error(
      'Cannot start both --server and --worker in the same process yet.',
    );
  }

  if (workerMode) {
    const serverUrl = readCliOption(args, '--serverurl');
    if (!serverUrl) {
      throw new Error('Missing required --serverurl for worker mode');
    }
    await runWorkerMode({ serverUrl });
    return;
  }

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

  if (generateSpec) {
    // Write OpenAPI spec to file and exit
    const outputPath = join(__dirname, '..', 'openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2));
    console.log(`OpenAPI specification written to ${outputPath}`);
    process.exit(0);
  }

  SwaggerModule.setup('api/v1/docs', app, document);

  // Serve static files from the UI build (in production)
  const staticPath = join(__dirname, 'public');
  const betaStaticPath = join(__dirname, 'public/beta'); // new UI build
  if (existsSync(staticPath)) {
    app.useStaticAssets(staticPath);
    console.log(`Serving static files from ${staticPath}`);

    // SPA fallback: serve index.html for all non-API, non-asset routes
    // This allows client-side routing to work.
    // Registered on the underlying HTTP adapter so it runs after NestJS
    // controllers (which handle /api/* routes) but catches everything else.
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.getInstance().use((req, res, next) => {
      // Don't intercept API routes, static assets, or well-known routes
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/.well-known/')
      ) {
        return next();
      }
      // Serve Beta UI
      if (req.path.startsWith('/beta')) {
        return res.sendFile(join(betaStaticPath, 'index.html'));
      }
      // Serve legacy UI for all other routes
      return res.sendFile(join(staticPath, 'index.html'));
    });
  }

  const config = getConfig();
  const cliPort = readCliOption(args, '--port');
  const port = cliPort ? Number(cliPort) : config.port;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

function printUsage(): void {
  console.log(`taico usage:

  taico
    Start the server.

  taico --server [--port <port>]
    Start the server explicitly.

  taico --worker --serverurl <url>
    Start worker mode against an existing Taico server.

  taico --generate-spec
    Generate the OpenAPI specification and exit.
`);
}

function readCliOption(args: string[], name: string): string | null {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }

  return args[index + 1] ?? null;
}

bootstrap();
