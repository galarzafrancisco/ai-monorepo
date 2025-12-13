# Agent API

ADK-based agent API service using Google's Agent Development Kit (ADK) with UV package management.

## Overview

This service provides an AI agent API powered by Google's ADK framework, integrated into the monorepo as a Python workspace alongside TypeScript services.

## Prerequisites

- Python 3.10 or higher
- [UV](https://github.com/astral-sh/uv) package manager (install with `pip install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`)

## Setup

### Install dependencies

```bash
# From the monorepo root
npm -w agent-api run setup

# Or directly in this directory
cd apps/agent-api
uv sync
```

This will:
1. Create a virtual environment in `.venv/`
2. Install `google-adk` and `litellm[ollama]`
3. Set up all dependencies

## Development

### Run the agent API

```bash
# From the monorepo root
npm -w agent-api run dev

# Or run with other services
npm run dev:with-agents

# Or directly in this directory
cd apps/agent-api
uv run python -m adk run
```

The agent will start and be available for queries.

## Project Structure

```
apps/agent-api/
├── src/
│   ├── __init__.py          # Package initialization
│   └── __main__.py          # ADK agent entry point
├── pyproject.toml           # UV configuration and dependencies
├── package.json             # npm workspace integration
└── README.md                # This file
```

## Agent Configuration

The agent is configured in `src/__main__.py`:
- **Name**: SimpleAgent
- **Model**: gpt-4
- **Instruction**: Basic helpful assistant

You can customize the agent by modifying the `Agent` initialization.

## Dependencies

- **google-adk**: Google's Agent Development Kit for building AI agents
- **litellm[ollama]**: LiteLLM with Ollama support for model flexibility

## Integration with Monorepo

This Python service integrates seamlessly with the TypeScript monorepo:
- Uses npm workspace commands for consistency
- Runs alongside backend/UI services with `concurrently`
- UV manages the Python virtual environment automatically
- Follows the same development patterns as other services

## Troubleshooting

### UV not found
Install UV:
```bash
pip install uv
# or
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Module not found errors
Ensure dependencies are installed:
```bash
npm -w agent-api run setup
```

### Port conflicts
The ADK default port may conflict with other services. Check ADK documentation for port configuration.
