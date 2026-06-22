# Family Ice backend (api + ingest + proximity worker in one process for the POC).
FROM node:20-slim

WORKDIR /app

# Workspace manifests first for layer caching.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/

# Install all workspaces (simulator/mobile are light dev deps; ok for POC image).
RUN npm install --workspaces --include-workspace-root || npm install

# Source.
COPY packages/shared packages/shared
COPY packages/backend packages/backend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@family-ice/backend"]
