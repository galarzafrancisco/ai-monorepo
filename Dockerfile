# Build stage
FROM node:24-alpine AS builder

WORKDIR /workdir

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY apps/ui/package*.json ./apps/ui/
COPY apps/ui2/package*.json ./apps/ui2/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/client/package*.json ./packages/client/
COPY packages/adk-session-store/package*.json ./packages/adk-session-store/
COPY packages/errors/package*.json ./packages/errors/
COPY packages/events/package*.json ./packages/events/
COPY packages/openapi-sdkgen/package*.json ./packages/openapi-sdkgen/

# Install all dependencies (including dev dependencies for building)
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy source code
COPY . .

# Build everything
RUN npm run build:prod

# Production stage
FROM node:24-alpine

WORKDIR /workdir

# Copy package files for production install
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/client/package*.json ./packages/client/
COPY packages/adk-session-store/package*.json ./packages/adk-session-store/
COPY packages/errors/package*.json ./packages/errors/
COPY packages/events/package*.json ./packages/events/

# Install only production dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /workdir/apps/backend/dist ./apps/backend/dist
COPY --from=builder /workdir/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workdir/packages/adk-session-store/dist ./packages/adk-session-store/dist
COPY --from=builder /workdir/packages/errors/dist ./packages/errors/dist
COPY --from=builder /workdir/packages/events/dist ./packages/events/dist

# Create directory for SQLite database
RUN mkdir -p /workdir/data

# Set environment variables
# NODE_ENV defaults to production (no need to set explicitly)
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
