import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AiModelSelectionEntity } from './ai-model-selection.entity';
import { AiProviderEntity } from './ai-provider.entity';
import { AiProvidersService, isAiProviderConfigured } from './ai-providers.service';
import {
  AiModelSelectionResult,
  ResolvedAiModelSelection,
  SetAiModelSelectionInput,
} from './dto/service/ai-providers.service.types';
import { AiModelJob, JOBS_FOLLOWING_CONVERSATION } from './enums';
import { AiModelNotSelectedError, AiProviderNotFoundError } from './errors/ai-providers.errors';

/**
 * Which provider and model each job uses. Read from the database on every
 * call, so a change applies to all backend processes at once.
 */
@Injectable()
export class AiModelSelectionsService {
  private readonly logger = new Logger(AiModelSelectionsService.name);

  constructor(
    @InjectRepository(AiModelSelectionEntity)
    private readonly selectionRepository: Repository<AiModelSelectionEntity>,
    @InjectRepository(AiProviderEntity)
    private readonly aiProviderRepository: Repository<AiProviderEntity>,
    private readonly aiProvidersService: AiProvidersService,
    private readonly dataSource: DataSource,
  ) {}

  /** Every job, selected or not, with what it effectively runs on. */
  async listSelections(): Promise<AiModelSelectionResult[]> {
    const [selections, providers] = await Promise.all([
      this.selectionRepository.find(),
      this.aiProviderRepository.find(),
    ]);
    const byJob = new Map(selections.map((selection) => [selection.job, selection]));
    const providersById = new Map(providers.map((provider) => [provider.id, provider]));

    return Object.values(AiModelJob).map((job) => {
      const own = byJob.get(job) ?? null;
      const followsConversation = !own && JOBS_FOLLOWING_CONVERSATION.includes(job);
      const effective = followsConversation ? byJob.get(AiModelJob.CONVERSATION) ?? null : own;
      const provider = effective ? providersById.get(effective.aiProviderId) : undefined;

      return {
        job,
        aiProviderId: own?.aiProviderId ?? null,
        modelId: own?.modelId ?? null,
        followsConversation,
        effectiveAiProviderId: effective?.aiProviderId ?? null,
        effectiveModelId: effective?.modelId ?? null,
        isReady: !!provider && isAiProviderConfigured(provider),
      };
    });
  }

  async setSelection(input: SetAiModelSelectionInput): Promise<AiModelSelectionResult> {
    this.logger.log({
      message: 'Setting AI model selection',
      job: input.job,
      aiProviderId: input.aiProviderId,
      modelId: input.modelId,
    });

    await this.dataSource.transaction(async (manager) => {
      // Holds the provider until the selection is stored, so it cannot be deleted in between.
      const provider = await manager.getRepository(AiProviderEntity).findOne({
        where: { id: input.aiProviderId },
        lock: { mode: 'pessimistic_read' },
      });
      if (!provider) {
        throw new AiProviderNotFoundError(input.aiProviderId);
      }

      // Upsert so two processes setting the same job at once cannot both insert.
      await manager
        .getRepository(AiModelSelectionEntity)
        .upsert(
          { job: input.job, aiProviderId: input.aiProviderId, modelId: input.modelId.trim() },
          ['job'],
        );
    });

    return this.getSelection(input.job);
  }

  async clearSelection(job: AiModelJob): Promise<void> {
    this.logger.log({ message: 'Clearing AI model selection', job });
    await this.selectionRepository.delete({ job });
  }

  /** The provider settings and model id a job should call. Throws when the job cannot run. */
  async resolve(job: AiModelJob): Promise<ResolvedAiModelSelection> {
    let selection = await this.selectionRepository.findOne({ where: { job } });
    if (!selection && JOBS_FOLLOWING_CONVERSATION.includes(job)) {
      selection = await this.selectionRepository.findOne({
        where: { job: AiModelJob.CONVERSATION },
      });
    }
    if (!selection) {
      throw new AiModelNotSelectedError(job);
    }

    const provider = await this.aiProvidersService.getAiProviderConfigById(selection.aiProviderId);
    return { provider, modelId: selection.modelId };
  }

  private async getSelection(job: AiModelJob): Promise<AiModelSelectionResult> {
    const selections = await this.listSelections();
    return selections.find((selection) => selection.job === job)!;
  }
}
