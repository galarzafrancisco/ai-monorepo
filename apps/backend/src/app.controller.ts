import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiOkResponse, ApiProduces } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/guards/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiOkResponse({
    description: 'Returns a greeting message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('launch')
  @Public()
  @ApiProduces('text/plain')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Launch script endpoint' })
  @ApiOkResponse({
    description: 'Returns the bash script to launch Taico',
    schema: {
      type: 'string',
    },
  })
  getLaunchScript(): string {
    return `#!/bin/bash

set -e

IMAGE=ghcr.io/galarzafrancisco/ai-monorepo:latest

PORT=9999                     # Port where the server will be accessible
CONTAINER_NAME=taico          # Name for the Docker container
DATABASE_PATH=~/.taico/data   # Path to the local directory for database storage

docker run --name $CONTAINER_NAME --restart unless-stopped -d \\
  -p $PORT:$PORT \\
  -e NODE_ENV=production \\
  -e PORT=$PORT \\
  -e ISSUER_URL=http://localhost:$PORT \\
  -e SECRETS_ENABLED=\\"true\\" \\
  -e ALLOW_PLAINTEXT_SECRETS_INSECURE=\\"true\\" \\
  -e DATABASE_PATH=/app/data/database.sqlite \\
  -v $DATABASE_PATH:/app/data \\
  $IMAGE

echo "Server started on port $PORT. Access it at http://localhost:$PORT"`;
  }
}
