import { useNavigate } from "react-router-dom";
import { Button, Card, Stack, Text, Row } from "../../ui/primitives";
import { TaskCard } from "../tasks/TaskCard";
import { Task } from "../tasks/types";
import "./LandingPage.css";

// Mock tasks for demonstration
const mockTasks: Task[] = [
  {
    id: "demo-task-1",
    name: "Review API design",
    description: "Review the new REST API endpoints for the user management system",
    status: "NOT_STARTED",
    assignee: "user-mike",
    assigneeActor: {
      id: "user-mike",
      type: "human",
      slug: "mike",
      displayName: "Mike",
      avatarUrl: null,
      introduction: null,
    },
    createdByActor: {
      id: "user-creator",
      type: "human",
      slug: "fran",
      displayName: "Francisco",
      avatarUrl: null,
      introduction: null,
    },
    tags: [
      { id: "tag-1", name: "project:store", color: "#98D8C8" }
    ],
    comments: [],
    artefacts: [],
    inputRequests: [],
    sessionId: null,
    dependsOnIds: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "demo-task-2",
    name: "Implement user authentication",
    description: "Add JWT-based authentication to the backend API",
    status: "FOR_REVIEW",
    assignee: "agent-codex",
    assigneeActor: {
      id: "agent-codex",
      type: "agent",
      slug: "codex",
      displayName: "Codex",
      avatarUrl: "/icons/OpenAI-black-monoblossom.svg",
      introduction: null,
    },
    createdByActor: {
      id: "user-creator",
      type: "human",
      slug: "fran",
      displayName: "Francisco",
      avatarUrl: null,
      introduction: null,
    },
    tags: [
      { id: "tag-2", name: "review ✅", color: "#4CAF50" },
      { id: "tag-3", name: "code", color: "#2196F3" },
      { id: "tag-4", name: "project:store", color: "#98D8C8" }
    ],
    comments: [
      {
        id: "comment-1",
        taskId: "demo-task-2",
        commenterName: "Codex",
        commenterActor: {
          id: "agent-codex",
          type: "agent",
          slug: "codex",
          displayName: "Codex",
          avatarUrl: "/icons/OpenAI-black-monoblossom.svg",
          introduction: null,
        },
        content: "Implementation complete, ready for review",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }
    ],
    artefacts: [],
    inputRequests: [],
    sessionId: null,
    dependsOnIds: [],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "demo-task-3",
    name: "Database schema help needed",
    description: "Need help deciding between SQL and NoSQL for our analytics data",
    status: "IN_PROGRESS",
    assignee: "user-mike",
    assigneeActor: {
      id: "user-mike",
      type: "human",
      slug: "mike",
      displayName: "Mike",
      avatarUrl: null,
      introduction: null,
    },
    createdByActor: {
      id: "user-creator",
      type: "human",
      slug: "fran",
      displayName: "Francisco",
      avatarUrl: null,
      introduction: null,
    },
    tags: [
      { id: "tag-5", name: "architecture", color: "#FF9800" }
    ],
    comments: [],
    artefacts: [],
    inputRequests: [
      {
        id: "input-1",
        taskId: "demo-task-3",
        askedByActorId: "agent-codex",
        assignedToActorId: "user-mike",
        question: "What's the expected data volume? This will help determine the best approach.",
        answer: null,
        resolvedAt: null,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        updatedAt: new Date(Date.now() - 7200000).toISOString(),
      }
    ],
    sessionId: null,
    dependsOnIds: [],
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      <div className="landing-container">
        <Stack spacing="8">
          {/* Hero Section */}
          <Stack spacing="4" align="center" className="landing-hero">
            <Text size="6" weight="bold" className="landing-title">
              Taico
            </Text>
            <Text size="4" tone="muted" className="landing-subtitle">
              Where people and agents collaborate in threads, using shared context to get work done
            </Text>
          </Stack>

          {/* Task Board Demo */}
          <Stack spacing="4">
            <Stack spacing="2">
              <Text size="5" weight="semibold">
                Tasks
              </Text>
              <Text size="3" tone="muted">
                Units of work that can be assigned to humans or AI agents. Track progress, add comments, and collaborate seamlessly.
              </Text>
            </Stack>

            <div className="landing-task-grid">
              {mockTasks.map((task) => (
                <div key={task.id} className="landing-task-item">
                  <TaskCard task={task} />
                </div>
              ))}
            </div>
          </Stack>

          {/* Features Grid */}
          <div className="landing-features-grid">
            <Card className="landing-feature-card">
              <Stack spacing="3">
                <Text size="4" weight="semibold">
                  📝 Context Blocks
                </Text>
                <Text size="2" tone="muted">
                  Shared knowledge and documentation that can be attached to tasks and threads. Keep important information accessible and reusable.
                </Text>
              </Stack>
            </Card>

            <Card className="landing-feature-card">
              <Stack spacing="3">
                <Text size="4" weight="semibold">
                  💬 Threads
                </Text>
                <Text size="2" tone="muted">
                  Rooms for coordinating related work. Organize multiple tasks, conversations, and context all in one place.
                </Text>
              </Stack>
            </Card>

            <Card className="landing-feature-card">
              <Stack spacing="3">
                <Text size="4" weight="semibold">
                  🤖 Agents
                </Text>
                <Text size="2" tone="muted">
                  AI assistants that can take on tasks, ask questions, and collaborate with you. Assign work to agents just like you would to teammates.
                </Text>
              </Stack>
            </Card>
          </div>

          {/* Flexibility Section */}
          <Card className="landing-flexibility-card">
            <Stack spacing="3">
              <Text size="4" weight="semibold">
                Use it your way
              </Text>
              <Text size="2" tone="muted">
                Taico adapts to your workflow. Use it as a personal todo app, a note-taking system with context,
                a chat interface with AI, or a full collaboration platform. Create tasks for AI, have AI create tasks
                for you, or use it purely for organizing your thoughts. When the moment is right, everything comes
                together because all the pieces are in the same place.
              </Text>
            </Stack>
          </Card>

          {/* Getting Started */}
          <Stack spacing="4">
            <Stack spacing="2">
              <Text size="5" weight="semibold">
                Getting Started
              </Text>
              <Text size="3" tone="muted">
                Taico is currently designed for self-hosted deployment on your own laptop as a personal tool.
                Multi-tenant SaaS is coming in the future.
              </Text>
            </Stack>

            <Card className="landing-setup-card">
              <Stack spacing="4">
                <Stack spacing="2">
                  <Text size="3" weight="semibold">
                    1. Start the Taico server
                  </Text>
                  <div className="landing-code-block">
                    <pre><code>{`IMAGE=ghcr.io/galarzafrancisco/ai-monorepo:main-409e79f
PORT=1234
DATABASE_PATH=$(pwd)/data

docker run --name taico --restart unless-stopped -d \\
  -p $PORT:$PORT \\
  -e NODE_ENV=production \\
  -e PORT=$PORT \\
  -e ISSUER_URL=http://localhost:$PORT \\
  -e SECRETS_ENABLED="true" \\
  -e ALLOW_PLAINTEXT_SECRETS_INSECURE="true" \\
  -e DATABASE_PATH=/app/data/database.sqlite \\
  -v $DATABASE_PATH:/app/data \\
  $IMAGE

# Access at http://localhost:1234`}</code></pre>
                  </div>
                </Stack>

                <Stack spacing="2">
                  <Text size="3" weight="semibold">
                    2. Start the worker (for AI agent support)
                  </Text>
                  <div className="landing-code-block">
                    <pre><code>{`PORT=1234

# Optional: For Google models via ADK
# export GOOGLE_CLOUD_PROJECT=""
# export GOOGLE_CLOUD_LOCATION=""
# export GOOGLE_GENAI_USE_VERTEXAI="True"

npx @taico/worker@0.2.8 --serverurl http://localhost:$PORT`}</code></pre>
                  </div>
                </Stack>

                <Row spacing="3">
                  <Button
                    variant="primary"
                    onClick={() => window.open('https://github.com/galarzafrancisco/taico', '_blank')}
                  >
                    View on GitHub
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => navigate('/login')}
                  >
                    Sign In
                  </Button>
                </Row>
              </Stack>
            </Card>
          </Stack>
        </Stack>
      </div>
    </div>
  );
}
