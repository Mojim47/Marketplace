FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --no-frozen-lockfile --ignore-scripts
COPY . .
RUN pnpm run build:api
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001 && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3001
CMD ["node", "dist/apps/api/src/main.js"]
