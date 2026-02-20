#!/bin/bash

# NPF Development - Docker Startup Script
# Usage: ./scripts/docker-start.sh [dev|prod]

set -e

MODE=${1:-dev}
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Starting NPF Development in $MODE mode..."

if [ "$MODE" == "dev" ]; then
    echo "📦 Building and starting development containers..."
    docker-compose -f docker-compose.dev.yml up --build
elif [ "$MODE" == "prod" ]; then
    echo "📦 Building and starting production containers..."
    docker-compose up --build -d
    echo ""
    echo "✅ NPF Development is running:"
    echo "   Frontend: http://localhost:3100"
    echo "   Backend:  http://localhost:8100"
    echo "   Ollama:   http://localhost:11435"
    echo ""
    echo "📋 Useful commands:"
    echo "   View logs:    docker-compose logs -f"
    echo "   Stop:         docker-compose down"
    echo "   Restart:      docker-compose restart"
else
    echo "❌ Unknown mode: $MODE"
    echo "Usage: ./scripts/docker-start.sh [dev|prod]"
    exit 1
fi
