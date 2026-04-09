FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files for dependency caching
COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

RUN bun install

# Copy source
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db

WORKDIR /app/apps/worker

CMD ["bun", "src/index.ts"]
