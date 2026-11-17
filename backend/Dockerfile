FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ARG GIT_COMMIT_SHA=dev
ARG BUILD_NUMBER=local

LABEL org.opencontainers.image.title="flix-backend" \
      org.opencontainers.image.source="https://github.com/kevincifuentesdev/flix" \
      org.opencontainers.image.revision="${GIT_COMMIT_SHA}"

ENV NODE_ENV=production
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_NUMBER=${BUILD_NUMBER}

COPY package.json package-lock.json ./
# Keep devDependencies installed so migrate-if-needed.mjs can invoke drizzle-kit at startup.
RUN npm ci

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/scripts ./scripts

USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate-if-needed.mjs && node scripts/seed-data.mjs && node dist/src/index.js"]
