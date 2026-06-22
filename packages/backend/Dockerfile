# Family Ice backend (api + ingest + proximity worker in one process for the POC).
FROM node:20-slim

WORKDIR /app

# All workspace manifests first (npm needs the full workspace tree to be valid),
# for layer caching. Source is copied after deps install.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/simulator/package.json packages/simulator/
COPY packages/mobile/package.json packages/mobile/

# Install ONLY the backend + shared workspaces (plus root tooling incl. tsx).
# Filtering keeps Expo/React-Native (mobile) and the simulator out of the API image.
# NODE_ENV is still unset here, so root devDependencies (tsx) are installed.
RUN npm install -w @family-ice/shared -w @family-ice/backend --include-workspace-root

# Source for the two workspaces we actually run.
COPY packages/shared packages/shared
COPY packages/backend packages/backend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@family-ice/backend"]
