import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../../auth/guards/decorators/require-scopes.decorator';
import { TasksScopes } from '../../tasks/tasks.scopes';
import { ExecutionTracesService } from './execution-traces.service';
import { ExecutionTraceNotFoundError } from './execution-traces.errors';
import { ListExecutionTracesQueryDto } from './dto/http/list-execution-traces-query.dto';
import {
  ExecutionTraceResponseDto,
  ExecutionTracesResponseDto,
} from './dto/http/execution-traces-response.dto';
import { CurrentWorkspace } from '../../auth/guards/decorators/current-workspace.decorator';
import { WorkspaceAccess } from '../../auth/guards/decorators/workspace-access.decorator';

@ApiTags('Executions')
@ApiCookieAuth('JWT-Cookie')
@WorkspaceAccess('scoped')
@Controller('executions/:executionId/traces')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class ExecutionTracesController {
  constructor(private readonly traces: ExecutionTracesService) {}

  @Get()
  @ApiOperation({
    summary: 'Read raw harness events for an active or historical execution',
  })
  @ApiOkResponse({ type: ExecutionTracesResponseDto })
  async list(
    @Param('executionId', ParseUUIDPipe) executionId: string,
    @Query() query: ListExecutionTracesQueryDto,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<ExecutionTracesResponseDto> {
    try {
      const result = await this.traces.list(
        workspaceId,
        executionId,
        query.afterSequence,
        query.limit,
        { latest: query.latest, beforeSequence: query.beforeSequence },
      );
      return {
        items: result.items.map(ExecutionTraceResponseDto.fromEntity),
        lifecycle: result.lifecycle.map(ExecutionTraceResponseDto.fromEntity),
        nextAfterSequence: result.nextAfterSequence,
        hasMoreBefore: result.hasMoreBefore,
      };
    } catch (error) {
      if (error instanceof ExecutionTraceNotFoundError)
        throw new NotFoundException(error.message);
      throw error;
    }
  }
}
