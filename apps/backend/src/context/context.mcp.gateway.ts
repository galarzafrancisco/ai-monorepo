import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContextService } from './context.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { ActorService } from 'src/identity-provider/actor.service';
import { MetaService } from 'src/meta/meta.service';
import { AuthContext, UserContext } from 'src/auth/guards/context/auth-context.types';

@Injectable()
export class ContextMcpGateway {
  constructor(
    private readonly contextService: ContextService,
    private readonly metaService: MetaService,
    private readonly actorService: ActorService,
  ) { }

  private buildServer(user: UserContext, authContext: AuthContext): McpServer {
    const server = new McpServer({
      name: 'context',
      version: '0.0.0',
    });

    server.registerTool(
      'list_pages',
      {
        title: 'List wiki pages',
        description:
          'Get a list of all wiki pages with metadata (title, id, author)',
        inputSchema: {
          tag: z.string().optional(),
        },
      },
      async ({ tag }) => {
        const pages = await this.contextService.listBlocks({ tag });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(pages),
            },
          ],
        };
      },
    );

    server.registerTool(
      'get_page',
      {
        title: 'Get wiki page',
        description: 'Retrieve the full content of a wiki page by ID',
        inputSchema: {
          blockId: z.string(),
        },
      },
      async ({ blockId }) => {
        const page = await this.contextService.getBlockById(blockId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page),
            },
          ],
        };
      },
    );

    server.registerTool(
      'create_page',
      {
        title: 'Create wiki page',
        description:
          'Create a new wiki page with title, content, author, and optional parent',
        inputSchema: {
          title: z.string(),
          content: z.string(),
          parentId: z.string().optional(),
          tagNames: z.array(z.string()).optional(),
        },
      },
      async ({ title, content, parentId, tagNames }) => {
        const page = await this.contextService.createBlock({
          title,
          content,
          createdByActorId: user.actorId,
          parentId,
          tagNames,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page),
            },
          ],
        };
      },
    );

    server.registerTool(
      'update_page',
      {
        title: 'Update wiki page',
        description:
          'Update the title, content, author, parent, or tags of an existing wiki page',
        inputSchema: {
          blockId: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
          author: z.string().optional(),
          parentId: z.string().nullable().optional(),
          tagNames: z.array(z.string()).optional(),
        },
      },
      async ({ blockId, title, content, author, parentId, tagNames }) => {
        if (
          title === undefined &&
          content === undefined &&
          author === undefined &&
          parentId === undefined &&
          tagNames === undefined
        ) {
          throw new Error(
            'At least one field must be provided to update the page.',
          );
        }

        const page = await this.contextService.updateBlock(blockId, {
          title,
          content,
          parentId,
          tagNames,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page),
            },
          ],
        };
      },
    );

    server.registerTool(
      'append_page',
      {
        title: 'Append wiki page content',
        description:
          'Append markdown content to the end of an existing wiki page',
        inputSchema: {
          blockId: z.string(),
          content: z.string(),
        },
      },
      async ({ blockId, content }) => {
        const page = await this.contextService.appendToBlock(blockId, {
          content,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(page),
            },
          ],
        };
      },
    );

    server.registerTool(
      'delete_page',
      {
        title: 'Delete wiki page',
        description: 'Delete a wiki page by its identifier',
        inputSchema: {
          blockId: z.string(),
        },
      },
      async ({ blockId }) => {
        await this.contextService.deleteBlock(blockId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ status: 'deleted', blockId }),
            },
          ],
        };
      },
    );

    server.registerTool(
      'add_tag_to_page',
      {
        title: 'Add tag to page',
        description:
          'Add a tag to a wiki page by tag name (creates tag if it does not exist)',
        inputSchema: {
          blockId: z.string(),
          tagName: z.string(),
        },
      },
      async ({ blockId, tagName }) => {
        await this.contextService.addTagToBlock(blockId, {
          name: tagName,
        },
          user.actorId,
        );

        return {
          content: [
            {
              type: 'text',
              text: 'done',
            },
          ],
        };
      },
    );

    server.registerTool(
      'remove_tag_from_page',
      {
        title: 'Remove tag from page',
        description: 'Remove a tag from a wiki page',
        inputSchema: {
          blockId: z.string(),
          tagId: z.string(),
        },
      },
      async ({ blockId, tagId }) => {
        await this.contextService.removeTagFromBlock(blockId, tagId);

        return {
          content: [
            {
              type: 'text',
              text: 'done',
            },
          ],
        };
      },
    );

    server.registerTool(
      'get_all_tags',
      {
        title: 'Get all tags',
        description: 'List all available tags',
      },
      async ({ }) => {
        const tags = await this.metaService.getAllTags();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tags),
            },
          ],
        };
      },
    );

    server.registerTool(
      'get_child_pages',
      {
        title: 'Get child pages',
        description:
          'Get all child pages for a given parent page ID (or null for root pages)',
        inputSchema: {
          parentId: z.string().nullable(),
        },
      },
      async ({ parentId }) => {
        const children = await this.contextService.getChildBlocks(parentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(children),
            },
          ],
        };
      },
    );

    server.registerTool(
      'get_page_tree',
      {
        title: 'Get page tree',
        description:
          'Get the complete hierarchical tree structure of all pages',
      },
      async ({ }) => {
        const tree = await this.contextService.getBlockTree();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tree),
            },
          ],
        };
      },
    );

    return server;
  }

  async handleRequest(
    req: Request,
    res: Response,
    user: UserContext,
    authContext: AuthContext,
  ) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer(user, authContext);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
