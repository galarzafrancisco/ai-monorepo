# How to Expose an MCP Server

MCP (Model Context Protocol) allows Claude and other AI assistants to interact with your services. Instead of exposing raw API endpoints 1:1, design tools around **user journeys**.

---

## Naming & Location

- File: `apps/backend/src/<domain>/<domain>.mcp.gateway.ts`
- Class: `<Domain>McpGateway`
- Injectable: `@Injectable()`

---

## Golden Rules

1) **Tools represent user journeys, not APIs**
   - ✅ `mark_task_in_progress` (assigns, changes status, adds comment)
   - ❌ `update_task_status` + `add_comment` (two separate raw API calls)
   - Think: What does the user want to accomplish?

2) **Keep descriptions short**
   - Use tokens wisely—models are smart
   - Title should be clear; description only if needed
   - Skip field descriptions unless complex

3) **Use Zod for input schemas**
   - Define required/optional fields
   - Let the model infer simple types
   - Only document complex inputs

4) **Return JSON in text content**
   - Use `JSON.stringify()` for responses
   - Optionally provide `structuredContent` for typed output

5) **Wire into controller with `@All('mcp')` endpoint**
   - Mount MCP gateway as provider in module
   - Create handler in controller to delegate requests

---

## Step-by-Step

### 1. Create the MCP Gateway

```ts
// apps/backend/src/taskeroo/taskeroo.mcp.gateway.ts
import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { TaskerooService } from "./taskeroo.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

@Injectable()
export class TaskerooMcpGateway {
  constructor(private readonly taskerooService: TaskerooService) {}

  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'taskeroo',
      version: '0.0.0',
    });

    // Register tools here
    server.registerTool(
      'list_tasks',
      {
        title: 'List tasks',
        description: 'Use to get a summary of tasks available',
      },
      async ({}) => {
        const tasks = await this.taskerooService.listTasks({
          page: 0,
          limit: 20,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tasks.items.map(t => ({
              name: t.name,
              assignee: t.assignee,
              status: t.status,
              id: t.id,
            }))),
          }],
        }
      }
    );

    return server;
  }

  async handleRequest(req: Request, res: Response) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
```

### 2. Register Journey Tools

Design tools around complete workflows:

```ts
server.registerTool(
  'mark_task_in_progress',
  {
    title: 'Start working on task',
    description: 'Assign task, set status to IN_PROGRESS, add comment with branch info',
    inputSchema: {
      taskId: z.string(),
      assignee: z.string(),
      sessionId: z.string(),
      branchName: z.string(),
    },
  },
  async ({ taskId, assignee, sessionId, branchName }) => {
    // Journey: Multiple operations in one tool
    await this.taskerooService.assignTask(taskId, { assignee, sessionId });
    await this.taskerooService.changeStatus(taskId, { status: 'IN_PROGRESS' });
    await this.taskerooService.addComment(taskId, {
      commenterName: assignee,
      content: `Starting to work on this. I've created the branch ${branchName}`,
    });

    const task = await this.taskerooService.getTaskById(taskId);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(task),
      }],
    }
  }
);
```

### 3. Wire into Module

Add the gateway as a provider:

```ts
// apps/backend/src/taskeroo/taskeroo.module.ts
import { TaskerooMcpGateway } from './taskeroo.mcp.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity, CommentEntity])],
  controllers: [TaskerooController],
  providers: [TaskerooService, TaskerooGateway, TaskerooMcpGateway],
  exports: [TaskerooService],
})
export class TaskerooModule {}
```

### 4. Add Controller Endpoint

Create an endpoint to handle MCP requests:

```ts
// apps/backend/src/taskeroo/taskeroo.controller.ts
import { TaskerooMcpGateway } from './taskeroo.mcp.gateway';

@Controller('taskeroo/tasks')
export class TaskerooController {
  constructor(
    private readonly taskerooService: TaskerooService,
    private readonly gateway: TaskerooMcpGateway,
  ) {}

  // ... other endpoints ...

  @All('mcp')
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.gateway.handleRequest(req, res);
  }
}
```

---

## Tool Design Patterns

### Simple Query Tool

No input schema needed if obvious:

```ts
server.registerTool(
  'list_tasks',
  {
    title: 'List tasks',
    description: 'Use to get a summary of tasks available',
  },
  async ({}) => {
    const tasks = await this.service.listTasks({ page: 0, limit: 20 });
    return {
      content: [{
        type: "text",
        text: JSON.stringify(tasks.items),
      }],
    };
  }
);
```

### Tool with Simple Inputs

Let model infer—no descriptions needed:

```ts
server.registerTool(
  'add_numbers',
  {
    title: 'Adds numbers',
    description: '', // Title is enough
    inputSchema: {
      a: z.number(),
      b: z.number(),
    },
  },
  async ({ a, b }) => {
    return {
      content: [{
        type: 'text',
        text: `${a} + ${b} = ${a + b}`,
      }],
    };
  }
);
```

### Journey Tool (Complex Workflow)

Multiple service calls orchestrated:

```ts
server.registerTool(
  'mark_task_done',
  {
    title: 'Mark task as done',
    description: 'Set status to DONE with completion comment',
    inputSchema: {
      taskId: z.string(),
      comment: z.string(),
    },
  },
  async ({ taskId, comment }) => {
    // Atomically change status and add comment
    await this.service.changeStatus(taskId, {
      status: 'DONE',
      comment,
    });

    const task = await this.service.getTaskById(taskId);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(task),
      }],
    };
  }
);
```

---

## Best Practices

### Token Efficiency

- Keep descriptions minimal
- Skip obvious field descriptions
- Use clear, short titles
- Omit outputSchema unless structure is complex

### Journey-Oriented Design

Ask: "What is the user trying to accomplish?"

- Bad: `change_status`, `add_comment` (user has to call both)
- Good: `mark_task_for_review` (changes status + adds PR link in one call)

### Error Handling

Let domain errors propagate—MCP will serialize them:

```ts
async ({ taskId }) => {
  // Service throws TaskNotFoundError if missing
  const task = await this.service.getTaskById(taskId);
  return { content: [{ type: "text", text: JSON.stringify(task) }] };
}
```

### Testing

Test via Claude Code or MCP inspector:

```bash
# Configure MCP in Claude Code settings
# Test tools interactively
```

---

## Related Guides

- `create-a-service` (business logic)
- `create-a-controller` (HTTP boundary)
- Review guide: `review-guides/mcp.md`
