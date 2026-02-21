#!/bin/bash
#
# NPF Server Restore Script
# Восстановление данных на сервер из бэкапа
#
# Использование:
#   ./scripts/restore-server.sh user@server.com /path/to/backup [/path/on/server]
#

set -e

SERVER="${1:-}"
BACKUP_DIR="${2:-}"
REMOTE_PATH="${3:-/opt/npf-project}"

if [ -z "$SERVER" ] || [ -z "$BACKUP_DIR" ]; then
    echo "Использование: $0 user@server /path/to/backup [/path/on/server]"
    echo ""
    echo "Пример:"
    echo "  $0 root@server ./backups/server_20260221_143000"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Ошибка: папка бэкапа не найдена: $BACKUP_DIR"
    exit 1
fi

echo "================================================"
echo "       NPF Server Restore"
echo "================================================"
echo ""
echo "Сервер:  $SERVER"
echo "Бэкап:   $BACKUP_DIR"
echo "Путь:    $REMOTE_PATH"
echo ""
echo "⚠️  ВНИМАНИЕ: Это перезапишет данные на сервере!"
read -p "Продолжить? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено."
    exit 0
fi

# Restore PostgreSQL
if [ -f "$BACKUP_DIR/postgres.sql" ]; then
    echo "[1/3] Восстановление PostgreSQL..."
    cat "$BACKUP_DIR/postgres.sql" | ssh "$SERVER" "cd $REMOTE_PATH && docker exec -i \$(docker ps -qf 'name=postgres') psql -U npf npf_db"
    echo "✓ PostgreSQL восстановлен"
else
    echo "[1/3] PostgreSQL бэкап не найден, пропускаем"
fi

# Restore ChromaDB
if [ -f "$BACKUP_DIR/chroma.tar.gz" ]; then
    echo "[2/3] Восстановление ChromaDB..."
    cat "$BACKUP_DIR/chroma.tar.gz" | ssh "$SERVER" "docker run --rm -i -v npf-project_npf_chroma:/dest alpine sh -c 'cd /dest && tar xzf -'"
    echo "✓ ChromaDB восстановлен"
else
    echo "[2/3] ChromaDB бэкап не найден, пропускаем"
fi

# Restore Documents
if [ -f "$BACKUP_DIR/documents.tar.gz" ]; then
    echo "[3/3] Восстановление документов..."
    cat "$BACKUP_DIR/documents.tar.gz" | ssh "$SERVER" "docker run --rm -i -v npf-project_npf_documents:/dest alpine sh -c 'cd /dest && tar xzf -'"
    echo "✓ Документы восстановлены"
else
    echo "[3/3] Documents бэкап не найден, пропускаем"
fi

echo ""
echo "================================================"
echo "✓ Восстановление завершено!"
echo ""
echo "Перезапустите приложение:"
echo "  ssh $SERVER 'cd $REMOTE_PATH && docker compose -f docker-compose.server.yml restart'"
echo "================================================"
