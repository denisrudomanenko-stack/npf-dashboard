#!/bin/bash
# NPF Project - Скрипт начала сессии
# Запускает проверки и выводит контекст для Claude

set -e
cd "$(dirname "$0")/.."

echo "=========================================="
echo "  NPF Project - Начало сессии"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Проверка Docker
echo -e "\n${YELLOW}[1/5] Проверка Docker...${NC}"
if docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null | grep -q "running"; then
    docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null
    echo -e "${GREEN}✓ Docker контейнеры запущены${NC}"
else
    echo -e "${RED}✗ Docker контейнеры не запущены${NC}"
    echo "  Запустите: docker compose up -d"
fi

# 2. Проверка целостности данных
echo -e "\n${YELLOW}[2/5] Проверка данных...${NC}"

# База данных
if [ -f "./db/npf.db" ]; then
    DB_SIZE=$(ls -lh ./db/npf.db | awk '{print $5}')
    ENTERPRISES=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM enterprises;" 2>/dev/null || echo "?")
    INTERACTIONS=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM interactions;" 2>/dev/null || echo "?")
    DOCUMENTS=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM documents;" 2>/dev/null || echo "?")
    echo -e "${GREEN}✓ База данных: ${DB_SIZE}${NC}"
    echo "  - Предприятий: $ENTERPRISES"
    echo "  - Взаимодействий: $INTERACTIONS"
    echo "  - Документов: $DOCUMENTS"
else
    echo -e "${RED}✗ База данных не найдена: ./db/npf.db${NC}"
fi

# ChromaDB
if [ -f "./chroma_db/chroma.sqlite3" ]; then
    CHROMA_SIZE=$(ls -lh ./chroma_db/chroma.sqlite3 | awk '{print $5}')
    echo -e "${GREEN}✓ ChromaDB: ${CHROMA_SIZE}${NC}"
else
    echo -e "${RED}✗ ChromaDB не найден${NC}"
fi

# 3. Проверка последнего бэкапа
echo -e "\n${YELLOW}[3/5] Бэкапы...${NC}"
LAST_BACKUP=$(ls -t ./backups/*.tar.gz 2>/dev/null | head -1)
if [ -n "$LAST_BACKUP" ]; then
    BACKUP_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$LAST_BACKUP" 2>/dev/null || stat -c "%y" "$LAST_BACKUP" 2>/dev/null | cut -d'.' -f1)
    BACKUP_SIZE=$(ls -lh "$LAST_BACKUP" | awk '{print $5}')
    echo -e "${GREEN}✓ Последний бэкап: $(basename $LAST_BACKUP) ($BACKUP_SIZE)${NC}"
    echo "  Дата: $BACKUP_DATE"
else
    echo -e "${YELLOW}⚠ Бэкапов нет. Создайте: ./scripts/backup.sh${NC}"
fi

# 4. Git статус
echo -e "\n${YELLOW}[4/5] Git статус...${NC}"
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current)
    COMMITS=$(git log --oneline -3 2>/dev/null)
    CHANGES=$(git status --short | wc -l | tr -d ' ')
    echo "  Ветка: $BRANCH"
    echo "  Несохранённых изменений: $CHANGES"
    echo "  Последние коммиты:"
    echo "$COMMITS" | sed 's/^/    /'
else
    echo -e "${YELLOW}⚠ Репозиторий Git не инициализирован${NC}"
fi

# 5. Краткий контекст
echo -e "\n${YELLOW}[5/5] Контекст проекта...${NC}"
if [ -f "./CLAUDE_CONTEXT.md" ]; then
    echo -e "${GREEN}✓ Файл контекста: CLAUDE_CONTEXT.md${NC}"
    echo ""
    echo "  Прочитай CLAUDE_CONTEXT.md для полного контекста"
else
    echo -e "${RED}✗ Файл CLAUDE_CONTEXT.md не найден${NC}"
fi

# 6. Лог последней сессии
if [ -f "./SESSION_LOG.md" ]; then
    echo -e "\n${YELLOW}Последняя сессия:${NC}"
    tail -20 ./SESSION_LOG.md | head -15
fi

echo -e "\n=========================================="
echo -e "${GREEN}Готово к работе!${NC}"
echo "=========================================="
