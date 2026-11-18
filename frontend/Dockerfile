FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# BACKEND ya no se fija en build: se define en runtime (ConfigMap de K8s).
# Las NEXT_PUBLIC_* si quedan congeladas en build.
ARG NEXT_PUBLIC_URL=http://localhost:5173
ENV NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p public
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ARG GIT_COMMIT_SHA=dev
ARG BUILD_NUMBER=local

LABEL org.opencontainers.image.title="flix-frontend" \
      org.opencontainers.image.source="https://github.com/kevincifuentesdev/flix" \
      org.opencontainers.image.revision="${GIT_COMMIT_SHA}"

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5173
ENV HOSTNAME=0.0.0.0
# Valor por defecto; en Kubernetes lo sobrescribe el ConfigMap.
ENV BACKEND=http://flix-backend:3000
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}
ENV BUILD_NUMBER=${BUILD_NUMBER}

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 5173

CMD ["node", "server.js"]