# LLM Module Guide

This guide explains how to use the backend LLM abstraction added to the codebase.

## Why this exists

We now centralize direct OpenAI Responses API calls in one place so feature services stay focused on business logic.

- Reusable provider adapter: `apps/backend/src/llm/openai-responses.service.ts`
- Module export: `apps/backend/src/llm/llm.module.ts`
- Feature-specific orchestration example: `apps/backend/src/threads/thread-title.service.ts`

## Rules

- Do not call `new OpenAI(...)` directly from feature services/controllers.
- Inject `OpenAiResponsesService` via `LlmModule`.
- Keep prompt/domain behavior in feature-specific services (for example, `ThreadTitleService`).
- Fail open on LLM errors unless the feature explicitly requires hard failure.

## How to use in a feature

1. Import `LlmModule` in the feature module.
2. Create a feature-level service for prompt construction and output shaping.
3. Inject `OpenAiResponsesService` into that feature-level service.
4. Inject the feature-level service into your domain service.

## Example pattern

```ts
// feature.module.ts
@Module({
  imports: [LlmModule],
  providers: [MyFeatureLlmService, MyFeatureService],
})
export class MyFeatureModule {}
```

```ts
// my-feature-llm.service.ts
@Injectable()
export class MyFeatureLlmService {
  constructor(private readonly openAiResponsesService: OpenAiResponsesService) {}

  async summarize(text: string): Promise<string | null> {
    return await this.openAiResponsesService.generateText({
      model: 'gpt-5.2',
      prompt: `Summarize the following text in one sentence:\n${text}`,
    });
  }
}
```

```ts
// my-feature.service.ts
@Injectable()
export class MyFeatureService {
  constructor(private readonly myFeatureLlmService: MyFeatureLlmService) {}

  async doWork(input: string): Promise<string> {
    const summary = await this.myFeatureLlmService.summarize(input);
    return summary || 'Fallback summary';
  }
}
```

## Resiliency behavior

`OpenAiResponsesService.generateText(...)` already handles common failure modes (missing key, quota, API errors, transient network issues):

- logs a warning
- returns `null`

Feature services must handle `null` with a deterministic fallback.

## Current reference implementation

- Generic adapter: `apps/backend/src/llm/openai-responses.service.ts`
- Feature-specific prompt logic: `apps/backend/src/threads/thread-title.service.ts`
- Feature orchestration fallback: `apps/backend/src/threads/threads.service.ts`
