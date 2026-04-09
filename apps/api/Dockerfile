# -- build stage --
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY apps/api ./apps/api
COPY packages/db ./packages/db

# -- runtime stage --
FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/packages/db ./packages/db
COPY --from=build /app/package.json ./

WORKDIR /app/apps/api
EXPOSE 4000

CMD ["bun", "src/index.ts"]
