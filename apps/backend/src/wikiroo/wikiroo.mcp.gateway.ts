import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { WikirooService } from "./wikiroo.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

@Injectable()
export class WikirooMcpGateway {

  constructor(private readonly wikirooService: WikirooService) { }

  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'wikiroo',
      version: '0.0.0',
    });

    server.registerTool(
      'list_pages',
      {
        title: 'List wiki pages',
        description: 'Get a list of all wiki pages with metadata (title, id, author)',
        inputSchema: {
          tag: z.string().optional(),
        },
      },
      async ({ tag }) => {
        const pages = await this.wikirooService.listPages({ tag });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(pages),
          }],
        }
      }
    )

    server.registerTool(
      'get_page',
      {
        title: 'Get wiki page',
        description: 'Retrieve the full content of a wiki page by ID',
        inputSchema: {
          pageId: z.string(),
        },
      },
      async ({ pageId }) => {
        const page = await this.wikirooService.getPageById(pageId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
        }
      }
    )

    server.registerTool(
      'create_page',
      {
        title: 'Create wiki page',
        description: 'Create a new wiki page with title, content, author, and optional parent',
        inputSchema: {
          title: z.string(),
          content: z.string(),
          author: z.string(),
          parentId: z.string().optional(),
          tagNames: z.array(z.string()).optional(),
        },
      },
      async ({ title, content, author, parentId, tagNames }) => {
        const page = await this.wikirooService.createPage({
          title,
          content,
          author,
          parentId,
          tagNames,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
        }
      }
    )

    server.registerTool(
      'update_page',
      {
        title: 'Update wiki page',
        description: 'Update the title, content, author, parent, or tags of an existing wiki page',
        inputSchema: {
          pageId: z.string(),
          title: z.string().optional(),
          content: z.string().optional(),
          author: z.string().optional(),
          parentId: z.string().nullable().optional(),
          tagNames: z.array(z.string()).optional(),
        },
      },
      async ({ pageId, title, content, author, parentId, tagNames }) => {
        if (title === undefined && content === undefined && author === undefined && parentId === undefined && tagNames === undefined) {
          throw new Error('At least one field must be provided to update the page.');
        }

        const page = await this.wikirooService.updatePage(pageId, {
          title,
          content,
          author,
          parentId,
          tagNames,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
        };
      }
    )

    server.registerTool(
      'append_page',
      {
        title: 'Append wiki page content',
        description: 'Append markdown content to the end of an existing wiki page',
        inputSchema: {
          pageId: z.string(),
          content: z.string(),
        },
      },
      async ({ pageId, content }) => {
        const page = await this.wikirooService.appendToPage(pageId, { content });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
        };
      }
    )

    server.registerTool(
      'delete_page',
      {
        title: 'Delete wiki page',
        description: 'Delete a wiki page by its identifier',
        inputSchema: {
          pageId: z.string(),
        },
      },
      async ({ pageId }) => {
        await this.wikirooService.deletePage(pageId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ status: 'deleted', pageId }),
          }],
        };
      }
    )

    server.registerTool(
      'add_tag_to_page',
      {
        title: 'Add tag to page',
        description: 'Add a tag to a wiki page by tag name (creates tag if it does not exist)',
        inputSchema: {
          pageId: z.string(),
          tagName: z.string(),
          color: z.string().optional(),
        },
      },
      async ({ pageId, tagName, color }) => {
        await this.wikirooService.addTagToPage(pageId, {
          name: tagName,
          color,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    server.registerTool(
      'remove_tag_from_page',
      {
        title: 'Remove tag from page',
        description: 'Remove a tag from a wiki page',
        inputSchema: {
          pageId: z.string(),
          tagId: z.string(),
        },
      },
      async ({ pageId, tagId }) => {
        await this.wikirooService.removeTagFromPage(pageId, tagId);

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    server.registerTool(
      'get_all_tags',
      {
        title: 'Get all tags',
        description: 'List all available tags',
      },
      async ({}) => {
        const tags = await this.wikirooService.getAllTags();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tags),
          }],
        }
      }
    )

    server.registerTool(
      'get_child_pages',
      {
        title: 'Get child pages',
        description: 'Get all child pages for a given parent page ID (or null for root pages)',
        inputSchema: {
          parentId: z.string().nullable(),
        },
      },
      async ({ parentId }) => {
        const children = await this.wikirooService.getChildPages(parentId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(children),
          }],
        }
      }
    )

    server.registerTool(
      'get_page_tree',
      {
        title: 'Get page tree',
        description: 'Get the complete hierarchical tree structure of all pages',
      },
      async ({}) => {
        const tree = await this.wikirooService.getPageTree();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tree),
          }],
        }
      }
    )

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

    const server = this.buildServer()
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
