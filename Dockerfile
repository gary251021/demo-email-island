# syntax=docker/dockerfile:1
ARG NODE_VERSION=26.10.0

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Production dependencies change only with the lockfile, so this layer stays cached across code changes.
FROM node:${NODE_VERSION}-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM deps AS build
COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
# Public dummy value for the local demo; override with docker run -e if needed.
ENV BETTER_AUTH_SECRET=email-island-local-demo-dummy-secret-00000000
ENV BETTER_AUTH_URL=http://localhost:3000
ENV EMAIL_ISLAND_DB_PATH=/app/.data/email-island.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir /app/.data && chown node:node /app/.data
USER node
EXPOSE 3000
CMD ["node", "node_modules/srvx/bin/srvx.mjs", "--prod", "--host", "0.0.0.0", "--port", "3000", "--static", "../client", "dist/server/server.mjs"]
