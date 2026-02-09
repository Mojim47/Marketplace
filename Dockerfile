# NextGen Marketplace - Production Dockerfile (Unified, Multi-Stage, pnpm)
# Semantic Versioning: MAJOR.MINOR.PATCH
# - MAJOR: Breaking changes
# - MINOR: New features (backward compatible)
# - PATCH: Bug fixes (backward compatible)

ARG VERSION=0.0.0
ARG BUILD_DATE
ARG VCS_REF
ARG BUILD_NUMBER

# Stage 1: Base - Setup pnpm and workspace
FROM node:20.18.1-alpine AS base

LABEL org.opencontainers.image.title="NextGen Marketplace"
LABEL org.opencontainers.image.description="Enterprise E-Commerce Platform for Iranian Market"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${VCS_REF}"
LABEL org.opencontainers.image.vendor="NextGen"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/nextgen/marketplace"

LABEL com.nextgen.build.number="${BUILD_NUMBER}"
LABEL com.nextgen.build.version="${VERSION}"

WORKDIR /app

ENV APP_VERSION=${VERSION}
ENV BUILD_DATE=${BUILD_DATE}
ENV VCS_REF=${VCS_REF}

RUN npm install -g pnpm

# Stage 2: Dependencies - Install all dependencies
FROM base AS deps

COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/admin/package.json ./apps/admin/
COPY apps/vendor-portal/package.json ./apps/vendor-portal/

RUN pnpm install --frozen-lockfile --prod=false

# Stage 3: Builder - Build the applications
FROM base AS builder

COPY . .
COPY --from=deps /app/node_modules ./node_modules

RUN pnpm exec prisma generate --schema=./prisma/schema.prisma

ENV NODE_ENV=production
RUN pnpm run build

# Stage 4: API Runner - Final image for the API
FROM base AS api
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./
USER nextjs
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3001/livez', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]

# Stage 5: Web Runner - Final image for the Web App
FROM base AS web
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3000/livez', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/web/server.js"]

# Stage 6: Admin Runner - Final image for the Admin App
FROM base AS admin
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3000/livez', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/admin/server.js"]

# Stage 8: Vendor Portal Runner - Final image for the Vendor Portal App
FROM base AS vendor-portal
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder --chown=nextjs:nodejs /app/apps/vendor-portal/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/vendor-portal/.next/static ./apps/vendor-portal/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/vendor-portal/public ./apps/vendor-portal/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "require('http').get('http://localhost:3000/livez', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"
CMD ["node", "apps/vendor-portal/server.js"]
