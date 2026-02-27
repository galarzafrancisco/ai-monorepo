# Deployment Guide

This document explains how Taico is deployed to production using Kubernetes and the GitOps workflow.

## Overview

Taico uses a two-repository GitOps approach for deployments:

1. **Application Repository** (this repo) — Contains the application code and Kubernetes manifest templates
2. **Deployment Repository** (separate, private repo) — Contains hydrated manifests with production secrets

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Application Repo                            │
│  • Source code (apps/backend, apps/ui2, etc.)                       │
│  • Kubernetes manifest templates (install/manifests/)               │
│  • CI/CD pipeline (.github/workflows/)                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ GitHub Actions CI
                                    │ (on push to main)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Deployment Repository                         │
│  • Hydrated Kubernetes manifests                                    │
│  • Production secrets (stored as repo secrets)                      │
│  • Automated CI to hydrate env.env                                  │
│  • Auto-merge to main                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ ArgoCD watches
                                    │ overlays/main
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Kubernetes Cluster                           │
│  • ArgoCD continuously syncs from deployment repo                   │
│  • Deploys to taico namespace                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Kubernetes Manifests Structure

The manifests follow Kustomize's base/overlay pattern:

```
install/manifests/
├── base/                          # Base Kubernetes resources
│   ├── kustomization.yaml         # Base kustomization config
│   ├── namespace.yaml             # Taico namespace
│   ├── configmap.yaml             # Environment variables (with placeholders)
│   ├── deployment.yaml            # Main application deployment
│   ├── service.yaml               # Kubernetes service
│   ├── ingress.yaml               # Ingress configuration
│   └── certificate.yaml           # TLS certificate
└── overlays/
    └── main/                      # Production overlay
        ├── kustomization.yaml     # Overlay-specific config with replacements
        └── env.env                # Environment-specific values (placeholders)
```

### Base ConfigMap

The base `configmap.yaml` defines all environment variables needed by the application with placeholder values:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: taico-config
  namespace: taico
data:
  NODE_ENV: "production"
  BACKEND_PORT: "3000"
  ISSUER_URL: PLACEHOLDER_ISSUER_URL
  ADK_URL: PLACEHOLDER_ADK_URL
  OLLAMA_URL: PLACEHOLDER_OLLAMA_URL
  OPENAI_KEY: PLACEHOLDER_OPENAI_KEY
  DATABASE_PATH: "/app/data/database.sqlite"
```

### Overlay Kustomization

The overlay `kustomization.yaml` uses Kustomize replacements to inject actual values from `env.env`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

configMapGenerator:
  - name: env
    envs:
      - env.env

resources:
- ../../base

replacements:
  # Example: Replace OPENAI_KEY placeholder with actual value
  - source:
      kind: ConfigMap
      name: env
      fieldPath: data.OPENAI_KEY
    targets:
      - select:
          kind: ConfigMap
          name: taico-config
        fieldPaths:
          - data.OPENAI_KEY
```

## Environment Variables Reference

### Required in Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `BACKEND_PORT` | Backend server port | `3000` |
| `ISSUER_URL` | OAuth issuer URL (must match public URL) | `https://taico.example.com` |
| `DATABASE_PATH` | SQLite database path | `/app/data/database.sqlite` |
| `OPENAI_KEY` | OpenAI API key for chat features | `sk-...` |

### Optional/Integration URLs

| Variable | Description | Example |
|----------|-------------|---------|
| `ADK_URL` | Google ADK service URL | `https://adk.example.com` |
| `OLLAMA_URL` | Ollama service URL | `https://ollama.example.com` |

## CI/CD Workflow

### 1. Application Repository CI

When code is pushed to the main branch:

1. GitHub Actions builds Docker images
2. Pushes images to GitHub Container Registry (ghcr.io)
3. Updates the image tag in `install/manifests/base/deployment.yaml`
4. Copies all manifest files to the deployment repository
5. Triggers deployment repository CI

### 2. Deployment Repository CI

The deployment repository has its own CI that:

1. Reads secrets from GitHub repository secrets
2. Hydrates `env.env` files with actual values (replacing placeholders)
3. Commits the changes
4. Auto-merges to main branch

### 3. ArgoCD Sync

ArgoCD continuously watches the deployment repository:

1. Detects changes to `overlays/main/kustomization.yaml`
2. Applies Kustomize replacements
3. Syncs manifests to the Kubernetes cluster
4. Performs rolling updates

## Adding New Secrets

To add a new secret/environment variable to production:

### Step 1: Update Application Manifests

1. Add placeholder to `install/manifests/base/configmap.yaml`:
   ```yaml
   data:
     NEW_SECRET: PLACEHOLDER_NEW_SECRET
   ```

2. Add replacement rule to `install/manifests/overlays/main/kustomization.yaml`:
   ```yaml
   replacements:
     - source:
         kind: ConfigMap
         name: env
         fieldPath: data.NEW_SECRET
       targets:
         - select:
             kind: ConfigMap
             name: taico-config
           fieldPaths:
             - data.NEW_SECRET
   ```

3. Add placeholder to `install/manifests/overlays/main/env.env`:
   ```
   NEW_SECRET=placeholder-value
   ```

4. Commit and push to the application repository

### Step 2: Configure Secret in Deployment Repository

1. Go to the deployment repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Add a new repository secret with the actual value
4. Update the deployment repository's CI to inject this secret into `env.env`

### Step 3: Verify Deployment

1. Check that CI runs successfully in both repos
2. Verify ArgoCD syncs the changes
3. Inspect the deployed ConfigMap: `kubectl -n taico get configmap taico-config -o yaml`
4. Verify the application can read the new environment variable

## Troubleshooting

### ConfigMap not updated

If you added a new environment variable but it's not appearing:

1. Check that the placeholder exists in base configmap
2. Verify the replacement rule in overlay kustomization
3. Ensure the value is in env.env
4. Check deployment repository CI logs

### Application can't read environment variable

1. Verify the ConfigMap has the correct value: `kubectl -n taico get configmap taico-config -o yaml`
2. Check that the deployment mounts the ConfigMap via `envFrom`
3. Restart pods to pick up ConfigMap changes: `kubectl -n taico rollout restart deployment/taico`

### ArgoCD out of sync

1. Check ArgoCD UI for sync errors
2. Compare deployed manifests with repository: `kubectl -n taico get deployment taico -o yaml`
3. Manually sync in ArgoCD if needed

## Security Best Practices

1. **Never commit actual secrets** to the application repository
2. All production secrets must be stored as GitHub repository secrets in the deployment repo
3. Use placeholder values in `env.env` files in the application repo
4. Rotate secrets regularly
5. Use least-privilege access for service accounts

## Local Development vs. Production

### Local Development

- Uses `.env` files in the monorepo root
- Secrets can be committed to local `.env.local` (gitignored)
- No Kustomize needed
- Environment variables loaded via `dotenv`

### Production

- Uses Kubernetes ConfigMaps
- Secrets managed via deployment repository
- Kustomize handles configuration templating
- Environment variables injected via `envFrom` in deployment spec

## Related Documentation

- [Admin Guide](ADMIN_GUIDE.md) — User management and running workers
- [Developer Guide](DEVELOPER_GUIDE.md) — Local development setup
- [Getting Started](GETTING_STARTED.md) — Basic usage and workflows
