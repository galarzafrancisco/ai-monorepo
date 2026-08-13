import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/outbox-event.entity';
import { OutboxEventTypes } from '../outbox/outbox-event-types';
import { TaskEntity } from './task.entity';
import { CommentEntity } from './comment.entity';
import { InputRequestEntity } from './input-request.entity';
import { ArtefactEntity } from './artefact.entity';
import {
  TaskCreatedEvent,
  TaskAssignedEvent,
  CommentAddedEvent,
  InputRequestAnsweredEvent,
  ArtefactAddedEvent,
  TaskDeletedEvent,
  TaskStatusChangedEvent,
  TaskUpdatedEvent,
} from './events/tasks.events';

@Injectable()
export class TaskOutboxProjectorService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    @InjectRepository(CommentEntity)
    private readonly commentRepository: Repository<CommentEntity>,
    @InjectRepository(InputRequestEntity)
    private readonly inputRequestRepository: Repository<InputRequestEntity>,
    @InjectRepository(ArtefactEntity)
    private readonly artefactRepository: Repository<ArtefactEntity>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(OutboxEventTypes.TASK_CREATED)
  async projectCreated(event: OutboxEventEntity): Promise<void> {
    const taskId = this.requiredString(event.payload.taskId, 'taskId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const task = await this.loadTask(taskId);
    this.eventEmitter.emit(
      TaskCreatedEvent.INTERNAL,
      new TaskCreatedEvent({ id: actorId }, task),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_UPDATED)
  async projectUpdated(event: OutboxEventEntity): Promise<void> {
    const taskId = this.requiredString(event.payload.taskId, 'taskId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const task = await this.loadTask(taskId);
    this.eventEmitter.emit(
      TaskUpdatedEvent.INTERNAL,
      new TaskUpdatedEvent({ id: actorId }, task),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_ASSIGNED)
  async projectAssigned(event: OutboxEventEntity): Promise<void> {
    const taskId = this.requiredString(event.payload.taskId, 'taskId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const task = await this.loadTask(taskId);
    this.eventEmitter.emit(
      TaskAssignedEvent.INTERNAL,
      new TaskAssignedEvent({ id: actorId }, task),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_COMMENT_ADDED)
  async projectCommentAdded(event: OutboxEventEntity): Promise<void> {
    const commentId = this.requiredString(event.payload.commentId, 'commentId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const comment = await this.commentRepository.findOne({
      where: { id: commentId },
      relations: ['commenterActor', 'task'],
    });
    if (!comment) {
      throw new Error(
        `Outbox task event references missing comment ${commentId}`,
      );
    }
    this.eventEmitter.emit(
      CommentAddedEvent.INTERNAL,
      new CommentAddedEvent({ id: actorId }, comment),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_INPUT_REQUEST_ANSWERED)
  async projectInputRequestAnswered(event: OutboxEventEntity): Promise<void> {
    const inputRequestId = this.requiredString(
      event.payload.inputRequestId,
      'inputRequestId',
    );
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const request = await this.inputRequestRepository.findOne({
      where: { id: inputRequestId },
    });
    if (!request) {
      throw new Error(
        `Outbox task event references missing input request ${inputRequestId}`,
      );
    }
    this.eventEmitter.emit(
      InputRequestAnsweredEvent.INTERNAL,
      new InputRequestAnsweredEvent({ id: actorId }, request),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_ARTEFACT_ADDED)
  async projectArtefactAdded(event: OutboxEventEntity): Promise<void> {
    const artefactId = this.requiredString(
      event.payload.artefactId,
      'artefactId',
    );
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const artefact = await this.artefactRepository.findOne({
      where: { id: artefactId },
      relations: ['task'],
    });
    if (!artefact) {
      throw new Error(
        `Outbox task event references missing artefact ${artefactId}`,
      );
    }
    this.eventEmitter.emit(
      ArtefactAddedEvent.INTERNAL,
      new ArtefactAddedEvent({ id: actorId }, artefact),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_STATUS_CHANGED)
  async projectStatusChanged(event: OutboxEventEntity): Promise<void> {
    const taskId = this.requiredString(event.payload.taskId, 'taskId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    const task = await this.loadTask(taskId);

    this.eventEmitter.emit(
      TaskStatusChangedEvent.INTERNAL,
      new TaskStatusChangedEvent({ id: actorId }, task),
    );
  }

  @OnEvent(OutboxEventTypes.TASK_DELETED)
  projectDeleted(event: OutboxEventEntity): void {
    const taskId = this.requiredString(event.payload.taskId, 'taskId');
    const actorId = this.requiredString(event.payload.actorId, 'actorId');
    this.eventEmitter.emit(
      TaskDeletedEvent.INTERNAL,
      new TaskDeletedEvent({ id: actorId }, taskId),
    );
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`Outbox task event has invalid ${field}`);
    }
    return value;
  }

  private async loadTask(taskId: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({
      where: { id: taskId },
      withDeleted: true,
      relations: [
        'comments',
        'comments.commenterActor',
        'artefacts',
        'inputRequests',
        'tags',
        'dependsOn',
        'assigneeActor',
        'createdByActor',
      ],
    });
    if (!task) {
      throw new Error(`Outbox task event references missing task ${taskId}`);
    }
    return task;
  }
}
