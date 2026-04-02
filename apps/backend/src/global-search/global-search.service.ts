import { Injectable, Logger } from '@nestjs/common';
import { TasksService } from '../tasks/tasks.service';
import { ContextService } from '../context/context.service';
import { ActorService } from '../identity-provider/actor.service';
import { ProjectsService } from '../meta/projects.service';
import { McpRegistryService } from '../mcp-registry/mcp-registry.service';
import { SearchResultType } from './dto/global-search-result.dto';

export type GlobalSearchInput = {
  query: string;
  limit?: number;
  threshold?: number;
};

export type GlobalSearchResult = {
  id: string;
  type: SearchResultType;
  title: string;
  score: number;
  url: string;
};

@Injectable()
export class GlobalSearchService {
  private readonly logger = new Logger(GlobalSearchService.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly contextService: ContextService,
    private readonly actorService: ActorService,
    private readonly projectsService: ProjectsService,
    private readonly mcpRegistryService: McpRegistryService,
  ) {}

  async search(input: GlobalSearchInput): Promise<GlobalSearchResult[]> {
    this.logger.log({
      message: 'Performing global search',
      query: input.query,
      limit: input.limit,
      threshold: input.threshold,
    });

    // Search in parallel across all modules
    const [taskResults, blockResults, actorResults, projectResults, toolResults] =
      await Promise.all([
        this.tasksService.searchTasks({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
        }),
        this.contextService.searchBlocks({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
        }),
        this.actorService.searchActors({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
        }),
        this.projectsService.searchProjects({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
        }),
        this.mcpRegistryService.searchServers({
          query: input.query,
          limit: input.limit,
          threshold: input.threshold,
        }),
      ]);

    // Map results to global format
    const results: GlobalSearchResult[] = [];

    // Add task results
    for (const task of taskResults) {
      results.push({
        id: task.id,
        type: SearchResultType.TASK,
        title: task.name,
        score: task.score,
        url: `/tasks/task/${task.id}`,
      });
    }

    // Add context block results
    for (const block of blockResults) {
      results.push({
        id: block.id,
        type: SearchResultType.CONTEXT_BLOCK,
        title: block.title,
        score: block.score,
        url: `/context/block/${block.id}`,
      });
    }

    // Add actor results
    for (const actorResult of actorResults) {
      results.push({
        id: actorResult.item.id,
        type: SearchResultType.AGENT,
        title: actorResult.item.displayName,
        score: actorResult.score,
        url: `/agents/agent/${actorResult.item.slug}`,
      });
    }

    // Add project results
    for (const projectResult of projectResults) {
      results.push({
        id: projectResult.id,
        type: SearchResultType.PROJECT,
        title: projectResult.slug,
        score: 1.0, // Projects service returns items without scores
        url: `/settings/projects`,
      });
    }

    // Add tool results
    for (const tool of toolResults) {
      results.push({
        id: tool.id,
        type: SearchResultType.TOOL,
        title: tool.name,
        score: tool.score,
        url: `/tools/tool/${tool.id}`,
      });
    }

    // Sort all results by score (highest first)
    results.sort((a, b) => b.score - a.score);

    this.logger.log({
      message: 'Global search completed',
      taskCount: taskResults.length,
      blockCount: blockResults.length,
      actorCount: actorResults.length,
      projectCount: projectResults.length,
      toolCount: toolResults.length,
      totalCount: results.length,
    });

    return results;
  }
}
