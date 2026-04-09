FROM oven/bun:1
WORKDIR /app

# Copy everything needed
COPY package.json bun.lock ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker

# Install deps
RUN bun install

WORKDIR /app/apps/worker

CMD ["bun", "src/index.ts"]
