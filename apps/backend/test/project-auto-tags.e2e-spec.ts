import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MetaService } from '../src/meta/meta.service';
import { ProjectsService } from '../src/meta/projects.service';
import { TasksService } from '../src/tasks/tasks.service';
import { ensureTestUser } from './helpers/auth.helper';

describe('Project automatic task tags', () => {
  let app: INestApplication;
  let actorId: string;
  let meta: MetaService;
  let projects: ProjectsService;
  let tasks: TasksService;
  let database: DataSource;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    actorId = await ensureTestUser(app);
    meta = app.get(MetaService);
    projects = app.get(ProjectsService);
    tasks = app.get(TasksService);
    database = app.get(DataSource);
  });

  afterAll(async () => { await app.close(); });

  it('preserves shared and manual tags as project memberships change', async () => {
    const shared = await meta.findOrCreateTagEntity('shared-auto-test');
    const manual = await meta.findOrCreateTagEntity('manual-auto-test');
    const first = await projects.createProject({ slug: 'auto-first' });
    const second = await projects.createProject({ slug: 'auto-second' });
    await projects.updateProject(first.id, { autoTagIds: [shared.id, manual.id] });
    await projects.updateProject(second.id, { autoTagIds: [shared.id] });

    const task = await tasks.createTask({
      name: 'Automatic tag provenance',
      description: 'Provenance test',
      createdByActorId: actorId,
      tagNames: [first.tagName, second.tagName, manual.name],
    });
    expect(task.tags.map((tag) => tag.name)).toEqual(expect.arrayContaining([shared.name, manual.name]));

    const oneProject = await tasks.removeTagFromTask(task.id, first.tagId, actorId);
    expect(oneProject.tags.map((tag) => tag.name)).toEqual(expect.arrayContaining([shared.name, manual.name]));

    const noProjects = await tasks.removeTagFromTask(task.id, second.tagId, actorId);
    expect(noProjects.tags.map((tag) => tag.name)).not.toContain(shared.name);
    expect(noProjects.tags.map((tag) => tag.name)).toContain(manual.name);
    expect(await database.query('SELECT * FROM task_auto_tags WHERE task_id = $1', [task.id])).toHaveLength(0);
  });

  it('removes only project-owned tags when deleting a project', async () => {
    const tag = await meta.findOrCreateTagEntity('deleted-project-auto-test');
    const first = await projects.createProject({ slug: 'auto-delete-first' });
    const second = await projects.createProject({ slug: 'auto-delete-second' });
    await projects.updateProject(first.id, { autoTagIds: [tag.id] });
    await projects.updateProject(second.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Project deletion provenance', description: 'Deletion test', createdByActorId: actorId,
      tagNames: [first.tagName, second.tagName],
    });
    await projects.deleteProject(first.id);
    expect((await tasks.getTaskById(task.id)).tags.map((item) => item.name)).toContain(tag.name);
    await projects.deleteProject(second.id);
    expect((await tasks.getTaskById(task.id)).tags.map((item) => item.name)).not.toContain(tag.name);
  });

  it('keeps an explicitly added auto tag after the project is removed', async () => {
    const tag = await meta.findOrCreateTagEntity('explicit-auto-test');
    const project = await projects.createProject({ slug: 'auto-explicit' });
    await projects.updateProject(project.id, { autoTagIds: [tag.id] });
    const task = await tasks.createTask({
      name: 'Explicit tag provenance', description: 'Manual addition test',
      createdByActorId: actorId, tagNames: [project.tagName],
    });
    await tasks.addTagToTask(task.id, { name: tag.name }, actorId);
    const updated = await tasks.removeTagFromTask(task.id, project.tagId, actorId);
    expect(updated.tags.map((item) => item.name)).toContain(tag.name);
  });
});
