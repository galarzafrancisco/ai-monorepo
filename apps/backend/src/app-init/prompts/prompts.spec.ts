import * as fs from 'fs';
import * as path from 'path';
import { ASSISTANT_PROMPT, DEV_PROMPT } from './prompts';
import { LEGACY_ASSISTANT_PROMPTS, LEGACY_DEV_PROMPTS } from './legacy-prompts';

/**
 * Guards the task-start workflow: claim the task before anything else, open a
 * draft PR early for repo changes, and don't force Git on work that changes
 * nothing in the repo.
 */
describe('developer workflow prompts', () => {
  const steps = (prompt: string) => prompt.split('\n');
  const lineOf = (prompt: string, needle: string | RegExp) =>
    steps(prompt).findIndex((line) =>
      typeof needle === 'string' ? line.includes(needle) : needle.test(line),
    );

  describe('DEV_PROMPT', () => {
    it('claims the task before reading, exploring or cutting a branch', () => {
      const claim = lineOf(DEV_PROMPT, 'Put the task in progress right away');
      expect(claim).toBeGreaterThan(-1);
      expect(claim).toBeLessThan(lineOf(DEV_PROMPT, 'Read the content'));
      expect(claim).toBeLessThan(lineOf(DEV_PROMPT, 'Cut a feature/ branch'));
      expect(DEV_PROMPT).not.toMatch(/in progress[^\n]*branch name/i);
    });

    it('for repo changes: opens a draft PR and attaches it before implementing', () => {
      const draft = lineOf(DEV_PROMPT, 'gh pr create --draft');
      expect(draft).toBeGreaterThan(
        lineOf(DEV_PROMPT, 'Cut a feature/ branch'),
      );
      expect(draft).toBeLessThan(lineOf(DEV_PROMPT, 'Do the work'));
      expect(steps(DEV_PROMPT)[draft]).toContain('add_artefact');
    });

    it('for repo changes: marks the PR ready before review', () => {
      const ready = lineOf(DEV_PROMPT, 'gh pr ready');
      expect(ready).toBeGreaterThan(-1);
      expect(ready).toBeLessThan(
        lineOf(DEV_PROMPT, /Mark the task as `in review`/),
      );
    });

    it('docs changes in the repo still go through a branch and PR', () => {
      expect(DEV_PROMPT).toMatch(/changes files in the repo \(code or docs\)/);
    });

    it('every Git/PR step is skippable when nothing in the repo changes', () => {
      const gitLines = steps(DEV_PROMPT).filter(
        (line) =>
          /branch|\bPR\b|\bgh\b|npm run/.test(line) &&
          /^(\d|- \[\])/.test(line) &&
          !line.includes('no branch needed'),
      );
      expect(gitLines.length).toBeGreaterThan(0);
      for (const line of gitLines) {
        expect(line).toContain('(repo)');
      }
    });

    it('gives work without repo changes its own finish path', () => {
      expect(DEV_PROMPT).toMatch(
        /If it doesn't[^\n]*skip the steps marked \(repo\)[^\n]*in review[^\n]*assign it to whoever created it/,
      );
    });
  });

  it('ASSISTANT_PROMPT claims the task before doing the work', () => {
    const claim = lineOf(
      ASSISTANT_PROMPT,
      'Put the task in progress right away',
    );
    expect(claim).toBeGreaterThan(-1);
    expect(claim).toBeLessThan(lineOf(ASSISTANT_PROMPT, '### Work'));
  });

  it('legacy prompts are different from the current ones, so the sync can tell them apart', () => {
    expect(LEGACY_DEV_PROMPTS).not.toContain(DEV_PROMPT);
    expect(LEGACY_ASSISTANT_PROMPTS).not.toContain(ASSISTANT_PROMPT);
  });

  describe('local start-task entry points', () => {
    const repoRoot = path.resolve(__dirname, '../../../../..');
    const files = [
      '.claude/commands/start-task.md',
      '.codex/prompts/start-task.md',
      'apps/worker-v1/src/prompts/start-task.md',
    ];

    it.each(files)(
      '%s claims the task before preparing a branch and opens a draft PR early',
      (file) => {
        const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
        const claim = lineOf(text, /in progress|mark_task_in_progress/);
        const branch = lineOf(text, /start_task\.sh|Cut a feature\/ branch/);
        expect(claim).toBeGreaterThan(-1);
        expect(branch).toBeGreaterThan(claim);
        expect(text).toMatch(/--draft/);
        expect(text).toMatch(/add_artefact/);
        expect(text).toMatch(
          /only if the task changes files in the repo|steps marked \(repo\)/i,
        );
      },
    );
  });
});
