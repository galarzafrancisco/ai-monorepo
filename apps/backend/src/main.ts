#!/usr/bin/env node
import './config/cli-env';
import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ProblemDetailsFilter } from './http/problem-details.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { getConfig } from './config/env.config';

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
  const serverMode = args.includes('--server');
  const generateOpenApiMode = args.includes('--generate-openapi');
  const cliPort = readCliOption(args, '--port');

  if (cliPort && !process.env.ISSUER_URL) {
    process.env.BACKEND_PORT = cliPort;
  }

  if (help) {
    printUsage();
    return;
  }

  if (serverMode && generateOpenApiMode) {
    throw new Error(
      'Cannot start both --server and --generate-openapi in the same process.',
    );
  }

  const app = await createConfiguredApp(AppModule);

  if (generateOpenApiMode) {
    await generateOpenApi(app);
    return;
  }

  const document = createSwaggerDocument(app);

  SwaggerModule.setup('api/v1/docs', app, document);

  // Serve static files from the UI build (in production)
  const staticPath = join(__dirname, 'public');
  const betaStaticPath = join(__dirname, 'public/beta'); // ui-v1 build
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
      // Serve ui-v1 under /beta.
      if (req.path.startsWith('/beta')) {
        return res.sendFile(join(betaStaticPath, 'index.html'));
      }
      // Serve active UI for all other routes.
      return res.sendFile(join(staticPath, 'index.html'));
    });
  }

  const config = getConfig();
  const port = cliPort ? Number(cliPort) : config.port;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}

async function createConfiguredApp(
  AppModule: typeof import('./app.module').AppModule,
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });
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

  return app;
}

function createSwaggerDocument(app: NestExpressApplication) {
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

  return SwaggerModule.createDocument(app, swaggerConfig);
}

async function generateOpenApi(
  app: NestExpressApplication,
): Promise<void> {
  const outputPath = join(__dirname, '..', 'openapi.json');
  const document = createSwaggerDocument(app);
  writeFileSync(outputPath, JSON.stringify(document, null, 2));
  logger.log(`OpenAPI specification written to ${outputPath}`);
  await app.close();
}

function printUsage(): void {
  console.log(`taico usage:

  taico
    Start the server.

  taico --server [--port <port>]
    Start the server explicitly.

  taico --generate-openapi
    Generate openapi.json without starting the server.
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
