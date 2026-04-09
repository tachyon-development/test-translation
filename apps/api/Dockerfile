FROM oven/bun:1
WORKDIR /app

# Copy everything needed
COPY package.json bun.lock ./
COPY packages/db ./packages/db
COPY apps/api ./apps/api

# Install deps
RUN bun install

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["bun", "src/index.ts"]
