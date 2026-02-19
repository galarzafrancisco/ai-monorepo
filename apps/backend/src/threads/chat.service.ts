import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
import { IssuedAccessTokenService } from "src/authorization-server/issued-access-token.service";
import { ThreadsService } from "./threads.service";
import { AgentsService } from "src/agents/agents.service";
import { AgentResult } from "src/agents/dto/service/agents.service.types";
// import { Agent, run } from "@openai/agents";
import { OpenAI } from 'openai';
import { getConfig } from "src/config/env.config";

@Injectable()
export class ChatService {

  private logger = new Logger(ChatService.name);

  constructor(
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
    private readonly issuedAccessTokenService: IssuedAccessTokenService,
  ) { }

  private async getSelf(): Promise<AgentResult> {
    const self = this.agentsService.getAgentBySlug({ slug: 'taico' });
    return self;
  }

  public async createConversation({ threadId }: { threadId: string }) {
    return { id: 'asd' }
    // const client = new OpenAI({
    //   apiKey: getConfig().openAiKey,
    // });
    // const conversation = await client.conversations.create({
    //   metadata: {
    //     threadId
    //   }
    // });
    // return conversation;
  }

  // private async getConversation({ conversationId }: { conversationId: string }) {
  //   const client = new OpenAI({
  //     apiKey: getConfig().openAiKey,
  //   });
  //   const conversation = await client.conversations.retrieve(conversationId);
  //   return conversation;
  // }

  public async sendMessageToThread({ conversationId, message, actorId }: { conversationId: string, message: string, actorId: string }) {
    // Get self
    const self = await this.getSelf();

    // // Make agent
    // const agent = new Agent({
    //   name: self.name,
    //   instructions: self.systemPrompt,
    //   model: self.modelId || 'gpt-5.2-codex',
    // });
    // this.logger.log(`Simulating message sent to ${conversationId}`);

    // const result = await run(agent, message, {
    //   conversationId,
    //   stream: true,
    // });

    // for await (const event of result) {
    //   this.logger.log(`event type: ${event.type}`);
    //   this.logger.log(event)
    // }
  }

}