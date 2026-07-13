import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { ServerLifecycleService } from './server-lifecycle.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly serverLifecycle: ServerLifecycleService,
  ) {}

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

  @Get('/health/live')
  @ApiOperation({ summary: 'Liveness check endpoint' })
  @ApiOkResponse({
    description: 'The process is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
      required: ['status'],
    },
  })
  getLive(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('/health/ready')
  @ApiOperation({ summary: 'Readiness check endpoint' })
  @ApiOkResponse({
    description: 'The server is ready to accept traffic',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ready' },
      },
      required: ['status'],
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'Shutdown has started and the server is not ready',
  })
  getReady(): { status: 'ready' } {
    if (!this.serverLifecycle.isReady()) {
      throw new ServiceUnavailableException('Server is shutting down');
    }

    return { status: 'ready' };
  }
}
