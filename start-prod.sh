#!/bin/bash
# Запуск production окружения с PostgreSQL

set -e

echo "==================================="
echo "NPF Production Environment"
echo "==================================="

# Проверка .env файла
if [ ! -f .env ]; then
    echo "Создаю .env из .env.example..."
    cp .env.example .env
    echo "⚠️  Отредактируйте .env и установите POSTGRES_PASSWORD!"
fi

# Запуск контейнеров
echo "Запуск контейнеров..."
docker compose -f docker-compose.prod.yml up -d

# Ожидание PostgreSQL
echo "Ожидание PostgreSQL..."
sleep 5

# Проверка статуса
echo ""
echo "Статус контейнеров:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "==================================="
echo "✅ Production окружение запущено!"
echo ""
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "==================================="
echo ""
echo "Для миграции данных из SQLite:"
echo "  python scripts/migrate_to_postgres.py"
echo ""
echo "Для остановки:"
echo "  docker compose -f docker-compose.prod.yml down"
