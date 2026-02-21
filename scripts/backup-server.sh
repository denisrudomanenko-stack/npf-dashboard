#!/bin/bash
#
# NPF Server Backup Script
# Создание бэкапа данных с сервера
#
# Использование:
#   ./scripts/backup-server.sh user@server.com [/path/on/server]
#

set -e

SERVER="${1:-}"
REMOTE_PATH="${2:-/opt/npf-project}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOCAL_BACKUP_DIR="./backups/server_$TIMESTAMP"

if [ -z "$SERVER" ]; then
    echo "Использование: $0 user@server [/path/on/server]"
    exit 1
fi

echo "================================================"
echo "       NPF Server Backup"
echo "================================================"
echo ""
echo "Сервер: $SERVER"
echo "Путь:   $REMOTE_PATH"
echo ""

mkdir -p "$LOCAL_BACKUP_DIR"

# Backup PostgreSQL
echo "[1/3] Бэкап PostgreSQL..."
ssh "$SERVER" "cd $REMOTE_PATH && docker exec \$(docker ps -qf 'name=postgres') pg_dump -U npf npf_db" > "$LOCAL_BACKUP_DIR/postgres.sql"
echo "✓ PostgreSQL: $(wc -l < "$LOCAL_BACKUP_DIR/postgres.sql") строк"

# Backup ChromaDB
echo "[2/3] Бэкап ChromaDB..."
ssh "$SERVER" "docker run --rm -v npf-project_npf_chroma:/source:ro alpine tar czf - -C /source ." > "$LOCAL_BACKUP_DIR/chroma.tar.gz"
echo "✓ ChromaDB: $(du -h "$LOCAL_BACKUP_DIR/chroma.tar.gz" | cut -f1)"

# Backup Documents
echo "[3/3] Бэкап документов..."
ssh "$SERVER" "docker run --rm -v npf-project_npf_documents:/source:ro alpine tar czf - -C /source ." > "$LOCAL_BACKUP_DIR/documents.tar.gz"
echo "✓ Документы: $(du -h "$LOCAL_BACKUP_DIR/documents.tar.gz" | cut -f1)"

echo ""
echo "================================================"
echo "Бэкап сохранён: $LOCAL_BACKUP_DIR"
echo "Размер: $(du -sh "$LOCAL_BACKUP_DIR" | cut -f1)"
echo "================================================"
