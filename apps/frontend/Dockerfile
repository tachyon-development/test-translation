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
WORKDIR /app/apps/frontend

COPY --from=build /app/apps/frontend/.next ./.next
COPY --from=build /app/apps/frontend/public ./public
COPY --from=build /app/apps/frontend/package.json ./
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/

EXPOSE 3000

CMD ["bun", "run", "start"]
