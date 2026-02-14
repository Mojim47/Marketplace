FROM node:25-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --prod --ignore-scripts || true
COPY . .
RUN npm run build || true
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001 && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3001
CMD ["node", "dist/main.js"]
