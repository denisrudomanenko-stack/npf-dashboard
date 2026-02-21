#!/bin/bash
#
# NPF Project Deployment Script
# Деплой проекта на удалённый сервер с миграцией данных
#
# Использование:
#   ./scripts/deploy.sh user@server.com [/path/on/server]
#
# Примеры:
#   ./scripts/deploy.sh root@192.168.1.100
#   ./scripts/deploy.sh deploy@myserver.com /opt/npf
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${1:-}"
REMOTE_PATH="${2:-/opt/npf-project}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/deploy_backup_$TIMESTAMP"

# Check arguments
if [ -z "$SERVER" ]; then
    echo -e "${RED}Ошибка: укажите сервер${NC}"
    echo ""
    echo "Использование: $0 user@server [/path/on/server]"
    echo ""
    echo "Примеры:"
    echo "  $0 root@192.168.1.100"
    echo "  $0 deploy@myserver.com /opt/npf"
    exit 1
fi

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}       NPF Project Deployment Script            ${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "Сервер:     ${GREEN}$SERVER${NC}"
echo -e "Путь:       ${GREEN}$REMOTE_PATH${NC}"
echo -e "Проект:     ${GREEN}$PROJECT_DIR${NC}"
echo ""

# Check SSH connection
echo -e "${YELLOW}[1/8] Проверка SSH подключения...${NC}"
if ! ssh -o ConnectTimeout=10 "$SERVER" "echo 'OK'" > /dev/null 2>&1; then
    echo -e "${RED}Ошибка: не удалось подключиться к $SERVER${NC}"
    echo "Проверьте SSH ключи и доступность сервера"
    exit 1
fi
echo -e "${GREEN}✓ SSH подключение успешно${NC}"

# Check Docker on server
echo -e "${YELLOW}[2/8] Проверка Docker на сервере...${NC}"
if ! ssh "$SERVER" "docker --version" > /dev/null 2>&1; then
    echo -e "${RED}Ошибка: Docker не установлен на сервере${NC}"
    echo "Установите Docker: https://docs.docker.com/engine/install/"
    exit 1
fi
if ! ssh "$SERVER" "docker compose version" > /dev/null 2>&1; then
    echo -e "${RED}Ошибка: Docker Compose не установлен на сервере${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker и Docker Compose доступны${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Export PostgreSQL data
echo -e "${YELLOW}[3/8] Экспорт PostgreSQL...${NC}"
if docker ps --format '{{.Names}}' | grep -q "npf-project-postgres-1"; then
    docker exec npf-project-postgres-1 pg_dump -U npf npf_db > "$BACKUP_DIR/postgres_backup.sql"
    echo -e "${GREEN}✓ PostgreSQL экспортирован ($(wc -l < "$BACKUP_DIR/postgres_backup.sql") строк)${NC}"
else
    echo -e "${YELLOW}⚠ PostgreSQL контейнер не запущен, пропускаем${NC}"
fi

# Export ChromaDB
echo -e "${YELLOW}[4/8] Экспорт ChromaDB (векторная база)...${NC}"
if docker volume ls --format '{{.Name}}' | grep -q "npf-project_npf_chroma"; then
    docker run --rm \
        -v npf-project_npf_chroma:/source:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf /backup/chroma_backup.tar.gz -C /source .
    echo -e "${GREEN}✓ ChromaDB экспортирован ($(du -h "$BACKUP_DIR/chroma_backup.tar.gz" | cut -f1))${NC}"
else
    echo -e "${YELLOW}⚠ ChromaDB volume не найден, пропускаем${NC}"
fi

# Export Documents
echo -e "${YELLOW}[5/8] Экспорт документов...${NC}"
if docker volume ls --format '{{.Name}}' | grep -q "npf-project_npf_documents"; then
    docker run --rm \
        -v npf-project_npf_documents:/source:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine tar czf /backup/documents_backup.tar.gz -C /source .
    echo -e "${GREEN}✓ Документы экспортированы ($(du -h "$BACKUP_DIR/documents_backup.tar.gz" | cut -f1))${NC}"
else
    echo -e "${YELLOW}⚠ Documents volume не найден, пропускаем${NC}"
fi

# Sync project files
echo -e "${YELLOW}[6/8] Синхронизация файлов проекта...${NC}"
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude 'db/*.db' \
    --exclude 'data/' \
    --exclude '.env' \
    --exclude '.env.server' \
    --exclude 'backups/' \
    --exclude 'chroma_db/' \
    --exclude 'deploy_backup_*' \
    --exclude '.claude' \
    "$PROJECT_DIR/" "$SERVER:$REMOTE_PATH/"

echo -e "${GREEN}✓ Файлы синхронизированы${NC}"

# Copy backups to server
echo -e "${YELLOW}[7/8] Копирование данных на сервер...${NC}"
scp -r "$BACKUP_DIR" "$SERVER:$REMOTE_PATH/"
echo -e "${GREEN}✓ Данные скопированы${NC}"

# Setup on server
echo -e "${YELLOW}[8/8] Настройка на сервере...${NC}"
ssh "$SERVER" bash << REMOTE_SCRIPT
set -e
cd "$REMOTE_PATH"

# Check if .env.server exists
if [ ! -f .env.server ]; then
    echo "Создаю .env.server из шаблона..."
    cp .env.server.example .env.server
    echo ""
    echo "⚠️  ВАЖНО: Отредактируйте .env.server и установите:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - SECRET_KEY"
    echo ""
fi

# Create volumes and import data
BACKUP_FOLDER=\$(ls -d deploy_backup_* 2>/dev/null | tail -1)

if [ -n "\$BACKUP_FOLDER" ]; then
    echo "Импорт данных из \$BACKUP_FOLDER..."

    # Start only postgres first
    docker compose -f docker-compose.server.yml --env-file .env.server up -d postgres
    sleep 10

    # Import PostgreSQL
    if [ -f "\$BACKUP_FOLDER/postgres_backup.sql" ]; then
        echo "Импорт PostgreSQL..."
        cat "\$BACKUP_FOLDER/postgres_backup.sql" | docker exec -i \$(docker ps -qf "name=postgres") psql -U npf npf_db
        echo "✓ PostgreSQL импортирован"
    fi

    # Import ChromaDB
    if [ -f "\$BACKUP_FOLDER/chroma_backup.tar.gz" ]; then
        echo "Импорт ChromaDB..."
        docker volume create npf-project_npf_chroma 2>/dev/null || true
        docker run --rm \
            -v npf-project_npf_chroma:/dest \
            -v "\$(pwd)/\$BACKUP_FOLDER:/backup:ro" \
            alpine sh -c "cd /dest && tar xzf /backup/chroma_backup.tar.gz"
        echo "✓ ChromaDB импортирован"
    fi

    # Import Documents
    if [ -f "\$BACKUP_FOLDER/documents_backup.tar.gz" ]; then
        echo "Импорт документов..."
        docker volume create npf-project_npf_documents 2>/dev/null || true
        docker run --rm \
            -v npf-project_npf_documents:/dest \
            -v "\$(pwd)/\$BACKUP_FOLDER:/backup:ro" \
            alpine sh -c "cd /dest && tar xzf /backup/documents_backup.tar.gz"
        echo "✓ Документы импортированы"
    fi
fi

echo ""
echo "Готово к запуску!"
REMOTE_SCRIPT

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}           Деплой завершён!                     ${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "Следующие шаги на сервере:"
echo ""
echo -e "  ${YELLOW}1. Подключитесь к серверу:${NC}"
echo -e "     ssh $SERVER"
echo ""
echo -e "  ${YELLOW}2. Отредактируйте конфигурацию:${NC}"
echo -e "     cd $REMOTE_PATH"
echo -e "     nano .env.server"
echo ""
echo -e "  ${YELLOW}3. Запустите приложение:${NC}"
echo -e "     docker compose -f docker-compose.server.yml --env-file .env.server up -d"
echo ""
echo -e "  ${YELLOW}4. Проверьте статус:${NC}"
echo -e "     docker compose -f docker-compose.server.yml ps"
echo ""
echo -e "Локальный бэкап сохранён в: ${BLUE}$BACKUP_DIR${NC}"
echo ""
