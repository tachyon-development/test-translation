#!/usr/bin/env bash
set -euo pipefail

echo "🏨 Setting up HospiQ..."

# Copy env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "⚠️  Update .env with real secrets before production use"
fi

# Start services
echo "Starting Docker services..."
docker compose up -d --build

# Wait for postgres
echo "Waiting for PostgreSQL..."
until docker compose exec -T postgres pg_isready -U hospiq > /dev/null 2>&1; do
  sleep 1
done

# Wait for Redis
echo "Waiting for Redis..."
until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  sleep 1
done

# Run migrations
echo "Running database migrations..."
docker compose exec -T api bun run /app/packages/db/node_modules/.bin/drizzle-kit push

# Seed data
echo "Seeding database..."
docker compose exec -T api bun run /app/packages/db/src/seed.ts

# Pull Ollama model
echo "Pulling llama3 model (this may take a few minutes)..."
docker compose exec -T ollama ollama pull llama3

echo ""
echo "✅ HospiQ is ready!"
echo ""
echo "  Open http://localhost in your browser"
echo "  Visit http://localhost/demo for guided exploration"
echo ""
echo "  Demo credentials: any email from the table below + password: demo2026"
echo ""
