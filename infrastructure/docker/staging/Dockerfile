# syntax=docker/dockerfile:1

# Build Stage
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

# Production Stage
FROM node:24-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/src/common/translation/locales ./src/common/translation/locales

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
