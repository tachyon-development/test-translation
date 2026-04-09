# -- build stage --
FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/db/package.json ./packages/db/

RUN bun install

COPY packages/db ./packages/db
COPY apps/frontend ./apps/frontend

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/frontend
RUN ./node_modules/.bin/next build || ../../node_modules/.bin/next build || bunx next build

# -- runtime stage --
FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /app/apps/frontend/public ./apps/frontend/public 2>/dev/null || true

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
