#!/bin/bash
# NPF Project - Скрипт создания бэкапа

set -e
cd "$(dirname "$0")/.."

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_DIR="./backups"
BACKUP_NAME="npf_backup_${TIMESTAMP}"

echo "=========================================="
echo "  NPF Project - Создание бэкапа"
echo "  $TIMESTAMP"
echo "=========================================="

mkdir -p "$BACKUP_DIR"

# Создаём временную директорию для бэкапа
TEMP_DIR=$(mktemp -d)
mkdir -p "$TEMP_DIR/$BACKUP_NAME"

# Копируем данные
echo "Копирование базы данных..."
cp -r ./db "$TEMP_DIR/$BACKUP_NAME/"

echo "Копирование ChromaDB..."
cp -r ./chroma_db "$TEMP_DIR/$BACKUP_NAME/"

echo "Копирование документов..."
cp -r ./data "$TEMP_DIR/$BACKUP_NAME/"

# Создаём архив
echo "Создание архива..."
cd "$TEMP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
mv "${BACKUP_NAME}.tar.gz" "$OLDPWD/$BACKUP_DIR/"

# Удаляем временные файлы
rm -rf "$TEMP_DIR"

cd "$OLDPWD"

# Информация о бэкапе
BACKUP_FILE="$BACKUP_DIR/${BACKUP_NAME}.tar.gz"
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')

echo ""
echo "=========================================="
echo "✓ Бэкап создан: $BACKUP_FILE"
echo "  Размер: $BACKUP_SIZE"
echo "=========================================="

# Удаляем старые бэкапы (оставляем последние 5)
echo ""
echo "Очистка старых бэкапов (оставляем последние 5)..."
ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
echo "Текущие бэкапы:"
ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
