# -- build stage --
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY apps/frontend ./apps/frontend
COPY packages/db ./packages/db

WORKDIR /app/apps/frontend
RUN bun run build

# -- runtime stage --
FROM oven/bun:1-slim AS runtime
WORKDIR /app

COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
