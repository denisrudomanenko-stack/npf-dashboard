#!/bin/bash
# Скрипт резервного копирования базы данных NPF

BACKUP_DIR="$(dirname "$0")/backups"
DB_FILE="$(dirname "$0")/db/npf.db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/npf_$TIMESTAMP.db"

mkdir -p "$BACKUP_DIR"

if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_FILE"
    COUNT=$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM enterprises" 2>/dev/null || echo "?")
    echo "Бэкап создан: $BACKUP_FILE"
    echo "Предприятий: $COUNT"

    # Удаление старых бэкапов (оставляем последние 10)
    ls -t "$BACKUP_DIR"/npf_*.db 2>/dev/null | tail -n +11 | xargs -r rm
else
    echo "Ошибка: база данных не найдена: $DB_FILE"
    exit 1
fi
