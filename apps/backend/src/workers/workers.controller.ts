import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WorkersService } from './workers.service';
import { WorkerResponseDto } from './dto/http/worker-response.dto';
import { AccessTokenGuard } from 'src/auth/guards/guards/access-token.guard';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { WorkersScopes } from 'src/executions/workers.scopes';
import { WorkerResult } from './dto/service/workers.service.types';

@ApiTags('workers')
@UseGuards(AccessTokenGuard, ScopesGuard)
@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  @RequireScopes(WorkersScopes.READ.id)
  @ApiOperation({ summary: 'List all workers' })
  @ApiResponse({
    status: 200,
    description: 'List of all registered workers',
    type: [WorkerResponseDto],
  })
  async listWorkers(): Promise<WorkerResponseDto[]> {
    const workers = await this.workersService.findAll();
    return workers.map((worker) => this.mapWorkerToResponse(worker));
  }

  private mapWorkerToResponse(worker: WorkerResult): WorkerResponseDto {
    return {
      id: worker.id,
      oauthClientId: worker.oauthClientId,
      workerVersion: worker.workerVersion,
      lastSeenAt: worker.lastSeenAt.toISOString(),
      harnesses: worker.harnesses,
      createdAt: worker.createdAt.toISOString(),
      updatedAt: worker.updatedAt.toISOString(),
    };
  }
}
