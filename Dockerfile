#### Multi-stage production image (<150MB target)

# --- Stage 1: Install prod deps only
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ openssl
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY libs/prisma/package.json ./libs/prisma/package.json
ENV HUSKY=0
RUN corepack enable && pnpm install --prod --frozen-lockfile --ignore-scripts

# --- Stage 2: Runner
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

# Copy compiled artifacts (assumed prebuilt)
COPY apps/api/dist ./apps/api/dist
COPY dist/libs ./dist/libs

# Copy production node modules + prisma engines
COPY --from=deps /app/node_modules ./node_modules

ENV NODE_ENV=production
USER node
CMD ["node", "apps/api/dist/main.js"]
