FROM oven/bun:1 AS base
WORKDIR /app

# Copy package files for dependency caching
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN bun install

# Copy source
COPY apps/api ./apps/api
COPY packages/db ./packages/db

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["bun", "src/index.ts"]
