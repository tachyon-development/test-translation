FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files for dependency caching
COPY package.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/db/package.json ./packages/db/

RUN bun install

# Copy source
COPY apps/frontend ./apps/frontend
COPY packages/db ./packages/db

WORKDIR /app/apps/frontend
EXPOSE 3000

CMD ["bun", "run", "start"]
