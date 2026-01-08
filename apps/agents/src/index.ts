import { assignHandler } from "./assignHandler";

async function main() {
  const taskId = 'the-task-id';
  const agentId = 'claude-dev';
  const repo = "https://github.com/galarzafrancisco/ai-monorepo.git";
  const result = await assignHandler(
    taskId,
    agentId,
    repo,
  )
  console.log(result);
}

main();