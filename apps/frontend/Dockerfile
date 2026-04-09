# -- build stage --
FROM oven/bun:1 AS build
WORKDIR /app

# Copy all source first
COPY package.json bun.lock ./
COPY packages/db ./packages/db
COPY apps/frontend ./apps/frontend

# Install all dependencies
RUN bun install

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/apps/frontend
RUN ls node_modules/.bin/next 2>/dev/null || ls ../../node_modules/.bin/next 2>/dev/null || echo "next not found anywhere" && \
    npx next build || ./node_modules/.bin/next build || ../../node_modules/.bin/next build

# -- runtime stage --
FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=build /app/apps/frontend/.next/standalone ./
COPY --from=build /app/apps/frontend/.next/static ./apps/frontend/.next/static

EXPOSE 3000

CMD ["node", "apps/frontend/server.js"]
