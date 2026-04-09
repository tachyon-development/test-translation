# -- build stage --
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY apps/worker ./apps/worker
COPY packages/db ./packages/db

# -- runtime stage --
FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker ./apps/worker
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./

WORKDIR /app/apps/worker

CMD ["bun", "src/index.ts"]
