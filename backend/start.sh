#!/bin/bash
set -e

# Wait for PostgreSQL if DATABASE_URL starts with postgresql
if [[ "$DATABASE_URL" == postgresql* ]]; then
    echo "Waiting for PostgreSQL..."

    # Extract host and port from DATABASE_URL
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:\/]*\).*/\1/p')
    PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

    if [ -z "$PORT" ]; then
        PORT=5432
    fi

    echo "Connecting to PostgreSQL at $HOST:$PORT"

    # Wait up to 30 seconds for PostgreSQL
    for i in {1..30}; do
        if nc -z "$HOST" "$PORT" 2>/dev/null; then
            echo "PostgreSQL is ready!"
            break
        fi
        echo "Waiting for PostgreSQL... attempt $i/30"
        sleep 1
    done
fi

echo "Starting FastAPI application..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
