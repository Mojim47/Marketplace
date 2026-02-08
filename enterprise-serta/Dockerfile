# ═══════════════════════════════════════════════════════════════════════════
# Enterprise-SERTA Dockerfile - Multi-stage Production Build
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# Stage 1: Base - Setup Node.js and pnpm
# ───────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# ───────────────────────────────────────────────────────────────────────────
# Stage 2: Dependencies - Install all dependencies
# ───────────────────────────────────────────────────────────────────────────
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --prod=false

# ───────────────────────────────────────────────────────────────────────────
# Stage 3: Builder - Build the application
# ───────────────────────────────────────────────────────────────────────────
FROM base AS builder

# Copy source code and dependencies
COPY . .
COPY --from=deps /app/node_modules ./node_modules

# Build the application
ENV NODE_ENV=production
RUN pnpm run build

# ───────────────────────────────────────────────────────────────────────────
# Stage 4: Production - Final runtime image
# ───────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S serta -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=serta:nodejs /app/dist ./dist
COPY --from=builder --chown=serta:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=serta:nodejs /app/package.json ./package.json

# Create directories for data and results
RUN mkdir -p /app/data /app/results /app/config && \
    chown -R serta:nodejs /app/data /app/results /app/config

# Switch to non-root user
USER serta

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Expose port
EXPOSE 8080

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the application
CMD ["node", "dist/index.js"]