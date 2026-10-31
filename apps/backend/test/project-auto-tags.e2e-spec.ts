import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TaskUpdatedEvent } from '../src/tasks/events/tasks.events';
import { AppModule } from '../src/app.module';
import { MetaService } from '../src/meta/meta.service';
import { ProjectsService } from '../src/meta/projects.service';
import { TasksService } from '../src/tasks/tasks.service';
import { ProjectAutoTagsService } from '../src/meta/project-auto-tags.service';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { ensureTestUser, getAuthCookies } from './helpers/auth.helper';

describe('Project automatic task tags', () => {
  let app: INestApplication;
  let actorId: string;
  let meta: MetaService;
  let projects: ProjectsService;
  let tasks: TasksService;
  let database: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    await app.init();
    actorId = await ensureTestUser(app);
    meta = app.get(MetaService);
    projects = app.get(ProjectsService);
    tasks = app.get(TasksService);
    database = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('preserves shared and manual tags as project memberships change', async () => {
    const shared = await meta.findOrCreateTagEntity('shared-auto-test');
    const manual = await meta.findOrCreateTagEntity('manual-auto-test');
    const first = await projects.createProject({ slug: 'auto-first' });
    const second = await projects.createProject({ slug: 'auto-second' });
    await projects.updateProject(first.id, {
      autoTagIds: [shared.id, manual.id],
    });
    await projects.updateProject(second.id, { autoTagIds: [shared.id] });

    const task = await tasks.createTask({
      name: 'Automatic tag provenance',
      description: 'Provenance test',
      createdByActorId: actorId,
      tagNames: [first.tagName, second.tagName, manual.name],
    });
    expect(task.tags.map((tag) => tag.name)).toEqual(
      expect.arrayContaining([shared.name, manual.name]),
    );

    const oneProject = await tasks.removeTagFromTask(
      task.id,
      first.tagId,
      actorId,
    );
    expect(oneProject.tags.map((tag) => tag.name)).toEqual(
      expect.arrayContaining([shared.name, manual.name]),
    );

    const noProjects = await tasks.removeTagFromTask(
      task.id,
      second.tagId,
      actorId,
    );
    expect(noProjects.tags.map((tag) => tag.name)).not.toContain(shared.name);
    expect(noProjects.tags.map((tag) => tag.name)).toContain(manual.name);
    expect(
      await database.query('SELECT * FROM task_auto_tags WHERE task_id = $1', [
        task.id,
      ]),
    ).toHaveLength(0);
  });

  it('removes only project-owned tags when deleting a project', async () => {
    const tag = await meta.findOrCreateTagEntity('deleted-project-auto-test');
    const first = await projects.createProject({ slug: 'auto-delete-first' });
    const second = await projects.createProject({ slug: 'auto-delete-second' });
    await projects.updateProject(first.id, { autoTagIds: [tag.id] });
    await projects.updateProject(second.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Project deletion provenance',
      description: 'Deletion test',
      createdByActorId: actorId,
      tagNames: [first.tagName, second.tagName],
    });
    await projects.deleteProject(first.id);
    expect(
      (await tasks.getTaskById(task.id)).tags.map((item) => item.name),
    ).toContain(tag.name);
    await projects.deleteProject(second.id);
    expect(
      (await tasks.getTaskById(task.id)).tags.map((item) => item.name),
    ).not.toContain(tag.name);
  });

  it('keeps an explicitly added auto tag after the project is removed', async () => {
    const tag = await meta.findOrCreateTagEntity('explicit-auto-test');
    const project = await projects.createProject({ slug: 'auto-explicit' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Explicit tag provenance',
      description: 'Manual addition test',
      createdByActorId: actorId,
      tagNames: [project.tagName],
    });
    await tasks.addTagToTask(task.id, { name: tag.name }, actorId);
    const updated = await tasks.removeTagFromTask(
      task.id,
      project.tagId,
      actorId,
    );
    expect(updated.tags.map((item) => item.name)).toContain(tag.name);
  });

  it('retains automatic tags when creating a task with dependencies', async () => {
    const tag = await meta.findOrCreateTagEntity('dependency-auto-test');
    const project = await projects.createProject({ slug: 'auto-dependency' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const dependency = await tasks.createTask({
      name: 'Dependency',
      description: 'Dependency test',
      createdByActorId: actorId,
    });
    const task = await tasks.createTask({
      name: 'Dependent project task',
      description: 'Dependency test',
      createdByActorId: actorId,
      tagNames: [project.tagName],
      dependsOnIds: [dependency.id],
    });
    expect(task.tags.map((item) => item.name)).toContain(tag.name);
    expect(
      (await tasks.getTaskById(task.id)).tags.map((item) => item.name),
    ).toContain(tag.name);
  });

  it('does not apply changed configurations to existing memberships on unrelated edits', async () => {
    const oldTag = await meta.findOrCreateTagEntity('snapshot-old-auto-test');
    const newTag = await meta.findOrCreateTagEntity('snapshot-new-auto-test');
    const otherTag = await meta.findOrCreateTagEntity(
      'snapshot-other-auto-test',
    );
    const first = await projects.createProject({ slug: 'auto-snapshot-first' });
    const second = await projects.createProject({
      slug: 'auto-snapshot-second',
    });
    await projects.updateProject(first.id, { autoTagIds: [oldTag.id] });
    await projects.updateProject(second.id, {
      autoTagIds: [oldTag.id, otherTag.id],
    });
    const task = await tasks.createTask({
      name: 'Snapshot task',
      description: 'Snapshot test',
      createdByActorId: actorId,
      tagNames: [first.tagName],
    });
    await projects.updateProject(first.id, { autoTagIds: [newTag.id] });
    const edited = await tasks.addTagToTask(
      task.id,
      { name: 'unrelated-auto-test' },
      actorId,
    );
    expect(edited.tags.map((item) => item.name)).toContain(oldTag.name);
    expect(edited.tags.map((item) => item.name)).not.toContain(newTag.name);

    const replaced = await tasks.updateTask(
      task.id,
      {
        tagNames: [first.tagName, second.tagName, 'unrelated-auto-test'],
      },
      actorId,
    );
    expect(replaced.tags.map((item) => item.name)).toEqual(
      expect.arrayContaining([oldTag.name, otherTag.name]),
    );
    expect(replaced.tags.map((item) => item.name)).not.toContain(newTag.name);
    const withoutFirst = await tasks.removeTagFromTask(
      task.id,
      first.tagId,
      actorId,
    );
    expect(withoutFirst.tags.map((item) => item.name)).toContain(oldTag.name);
    const withoutSecond = await tasks.removeTagFromTask(
      task.id,
      second.tagId,
      actorId,
    );
    expect(withoutSecond.tags.map((item) => item.name)).not.toContain(
      oldTag.name,
    );
  });

  it('treats explicitly retained tags in a full replacement as manual', async () => {
    const tag = await meta.findOrCreateTagEntity('replacement-auto-test');
    const project = await projects.createProject({ slug: 'auto-replacement' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Replacement task',
      description: 'Replacement test',
      createdByActorId: actorId,
      tagNames: [project.tagName],
    });
    const updated = await tasks.updateTask(
      task.id,
      { tagNames: [tag.name] },
      actorId,
    );
    expect(updated.tags.map((item) => item.name)).toContain(tag.name);
    expect(
      await database.query('SELECT * FROM task_auto_tags WHERE task_id = $1', [
        task.id,
      ]),
    ).toHaveLength(0);
  });

  it('does not backfill a membership whose configuration was initially empty', async () => {
    const tag = await meta.findOrCreateTagEntity('empty-config-auto-test');
    const project = await projects.createProject({ slug: 'auto-empty-config' });
    const task = await tasks.createTask({
      name: 'Empty config task',
      description: 'Empty configuration test',
      createdByActorId: actorId,
      tagNames: [project.tagName],
    });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const edited = await tasks.updateTask(
      task.id,
      { tagNames: [project.tagName] },
      actorId,
    );
    expect(edited.tags.map((item) => item.name)).not.toContain(tag.name);
    const added = await tasks.addTagToTask(
      task.id,
      { name: project.tagName },
      actorId,
    );
    expect(added.tags.map((item) => item.name)).not.toContain(tag.name);
  });

  it('emits a task update after project deletion with the final membership and tags', async () => {
    const tag = await meta.findOrCreateTagEntity('deletion-event-auto-test');
    const project = await projects.createProject({
      slug: 'auto-deletion-event',
    });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Deletion event task',
      description: 'Deletion event test',
      createdByActorId: actorId,
      tagNames: [project.tagName],
    });
    const indexedTags = async () => {
      const rows: { keywords: string }[] = await database.query(
        `SELECT keywords FROM search_documents WHERE entity_type = 'task' AND entity_id = $1`,
        [task.id],
      );
      return rows[0]?.keywords ?? '';
    };
    const waitForIndex = async (predicate: (keywords: string) => boolean) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (predicate(await indexedTags())) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error(`Task index did not update: ${await indexedTags()}`);
    };
    await waitForIndex((keywords) => keywords.includes(tag.name));
    const events = app.get(EventEmitter2);
    const emitted = jest.spyOn(events, 'emit');
    try {
      await projects.deleteProject(project.id);
      const updates = emitted.mock.calls.filter(
        ([name, event]) =>
          name === TaskUpdatedEvent.INTERNAL &&
          event instanceof TaskUpdatedEvent &&
          event.payload.id === task.id,
      );
      expect(updates).toHaveLength(1);
      const payload = (updates[0][1] as TaskUpdatedEvent).payload;
      expect(payload.tags.map((item) => item.name)).not.toContain(tag.name);
      expect(payload.tags.map((item) => item.name)).not.toContain(
        project.tagName,
      );
      await waitForIndex(
        (keywords) =>
          !keywords.includes(tag.name) && !keywords.includes(project.tagName),
      );
    } finally {
      emitted.mockRestore();
    }
  });

  it('rejects deleting a project tag through the generic tag endpoint, preserving provenance', async () => {
    const tag = await meta.findOrCreateTagEntity('generic-delete-auto-test');
    const first = await projects.createProject({
      slug: 'auto-generic-delete-first',
    });
    const second = await projects.createProject({
      slug: 'auto-generic-delete-second',
    });
    await projects.updateProject(first.id, { autoTagIds: [tag.id] });
    await projects.updateProject(second.id, { autoTagIds: [tag.id] });
    const shared = await tasks.createTask({
      name: 'Generic delete shared',
      description: 'Shared provenance test',
      createdByActorId: actorId,
      tagNames: [first.tagName, second.tagName],
    });
    const manual = await tasks.createTask({
      name: 'Generic delete manual',
      description: 'Manual provenance test',
      createdByActorId: actorId,
      tagNames: [first.tagName, tag.name],
    });
    const cookies = await getAuthCookies(app.getHttpServer());
    await request(app.getHttpServer())
      .delete(`/api/v1/meta/tags/${first.tagId}`)
      .set('Cookie', cookies)
      .expect(400);
    expect(
      (await tasks.getTaskById(shared.id)).tags.map((item) => item.name),
    ).toContain(first.tagName);
    expect(
      await database.query('SELECT * FROM task_auto_tags WHERE task_id = $1', [
        shared.id,
      ]),
    ).not.toHaveLength(0);
    await projects.deleteProject(first.id);
    expect(
      (await tasks.getTaskById(shared.id)).tags.map((item) => item.name),
    ).toContain(tag.name);
    expect(
      (await tasks.getTaskById(manual.id)).tags.map((item) => item.name),
    ).toContain(tag.name);
    await projects.deleteProject(second.id);
    expect(
      (await tasks.getTaskById(shared.id)).tags.map((item) => item.name),
    ).not.toContain(tag.name);
  });

  it('rolls back membership when provenance synchronization fails', async () => {
    const tag = await meta.findOrCreateTagEntity('rollback-auto-test');
    const project = await projects.createProject({ slug: 'auto-rollback' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Rollback task',
      description: 'Rollback test',
      createdByActorId: actorId,
    });
    const autoTags = app.get(ProjectAutoTagsService);
    const spy = jest
      .spyOn(autoTags, 'syncTask')
      .mockRejectedValueOnce(new Error('sync failed'));
    try {
      await expect(
        tasks.addTagToTask(task.id, { name: project.tagName }, actorId),
      ).rejects.toThrow('sync failed');
    } finally {
      spy.mockRestore();
    }
    expect(
      (await tasks.getTaskById(task.id)).tags.map((item) => item.name),
    ).not.toContain(project.tagName);
    expect(
      await database.query('SELECT * FROM task_auto_tags WHERE task_id = $1', [
        task.id,
      ]),
    ).toHaveLength(0);
    const retried = await tasks.addTagToTask(
      task.id,
      { name: project.tagName },
      actorId,
    );
    expect(retried.tags.map((item) => item.name)).toContain(tag.name);
  });

  it('serializes concurrent additions of the same project', async () => {
    const tag = await meta.findOrCreateTagEntity('concurrent-auto-test');
    const project = await projects.createProject({ slug: 'auto-concurrent' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Concurrent task',
      description: 'Concurrency test',
      createdByActorId: actorId,
    });
    await Promise.all(
      Array.from({ length: 3 }, () =>
        tasks.addTagToTask(task.id, { name: project.tagName }, actorId),
      ),
    );
    expect(
      (await tasks.getTaskById(task.id)).tags.filter(
        (item) => item.name === tag.name,
      ),
    ).toHaveLength(1);
    expect(
      await database.query(
        'SELECT * FROM task_auto_tags WHERE task_id = $1 AND project_id = $2 AND tag_id = $3',
        [task.id, project.id, tag.id],
      ),
    ).toHaveLength(1);
  });
});
