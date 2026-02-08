# syntax=docker/dockerfile:1.7
# Multi-stage build for @nextgen/api
FROM node:20.11.1-slim AS base
ENV NODE_ENV=production
WORKDIR /workspace

# Install pnpm
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY libs/auth/package.json libs/auth/package.json
COPY libs/payment/package.json libs/payment/package.json
COPY libs/invoice/package.json libs/invoice/package.json
COPY libs/security/package.json libs/security/package.json
COPY libs/fraud/package.json libs/fraud/package.json
COPY libs/tax/package.json libs/tax/package.json
COPY libs/cooperation/package.json libs/cooperation/package.json
COPY libs/ai/package.json libs/ai/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm-store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.json
COPY apps apps
COPY libs libs
RUN pnpm run build

# Production image
FROM base AS runner
LABEL org.opencontainers.image.source="https://example.local/nextgen-marketplace" \
      org.opencontainers.image.security.scan="trivy" \
      org.opencontainers.image.vendor="NextGen" \
      org.opencontainers.image.licenses="CPL-V3"

# Add non-root user
RUN useradd -u 10001 -r -g users nextgen && mkdir -p /workspace && chown -R nextgen:users /workspace
USER nextgen
WORKDIR /workspace

# Copy built artifacts only
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/node_modules ./node_modules
COPY package.json ./package.json

EXPOSE 3000
ENV PORT=3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>{if(!r.ok)process.exit(1)})" || exit 1
CMD ["node","apps/api/dist/main.js"]