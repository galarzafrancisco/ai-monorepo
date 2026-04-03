import { Controller, Get, UseGuards } from '@nestjs/common';
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
import { ActiveTaskExecutionService } from './active-task-execution.service';
import { ActiveTaskExecutionResponseDto } from './dto/http/active-task-execution-response.dto';

@ApiTags('Executions V2')
@ApiCookieAuth('JWT-Cookie')
@Controller('executions-v2/active')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(TasksScopes.READ.id)
export class ActiveTaskExecutionController {
  constructor(
    private readonly activeTaskExecutionService: ActiveTaskExecutionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active task executions',
    description:
      'Returns the tasks currently being worked on in the v2 execution system.',
  })
  @ApiOkResponse({ type: [ActiveTaskExecutionResponseDto] })
  async listActiveExecutions(): Promise<ActiveTaskExecutionResponseDto[]> {
    const executions = await this.activeTaskExecutionService.listActiveExecutions();
    return executions.map((execution) =>
      ActiveTaskExecutionResponseDto.fromEntity(execution),
    );
  }
}
