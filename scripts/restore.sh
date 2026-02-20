#!/bin/bash
# NPF Project - Скрипт восстановления из бэкапа
# Использование: ./scripts/restore.sh [путь_к_бэкапу]

set -e
cd "$(dirname "$0")/.."

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Доступные бэкапы:"
    ls -lh ./backups/*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
    echo ""
    echo "Использование: ./scripts/restore.sh ./backups/npf_backup_YYYYMMDD_HHMMSS.tar.gz"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Ошибка: файл не найден: $BACKUP_FILE"
    exit 1
fi

echo "=========================================="
echo "  NPF Project - Восстановление из бэкапа"
echo "  Файл: $BACKUP_FILE"
echo "=========================================="

read -p "Это заменит текущие данные. Продолжить? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 0
fi

# Останавливаем контейнеры
echo "Остановка контейнеров..."
docker compose stop backend 2>/dev/null || true

# Распаковываем бэкап
echo "Распаковка бэкапа..."
TEMP_DIR=$(mktemp -d)
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Находим директорию с данными
BACKUP_DIR=$(ls "$TEMP_DIR")

# Восстанавливаем данные
echo "Восстановление базы данных..."
rm -rf ./db
cp -r "$TEMP_DIR/$BACKUP_DIR/db" ./

echo "Восстановление ChromaDB..."
rm -rf ./chroma_db
cp -r "$TEMP_DIR/$BACKUP_DIR/chroma_db" ./

echo "Восстановление документов..."
rm -rf ./data
cp -r "$TEMP_DIR/$BACKUP_DIR/data" ./

# Очистка
rm -rf "$TEMP_DIR"

# Запускаем контейнеры
echo "Запуск контейнеров..."
docker compose up -d backend

echo ""
echo "=========================================="
echo "✓ Данные восстановлены!"
echo "=========================================="
