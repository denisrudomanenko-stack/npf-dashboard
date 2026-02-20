#!/bin/bash
# NPF Project - Скрипт завершения сессии
# Использование: ./scripts/session-end.sh "Краткое описание сделанного"

set -e
cd "$(dirname "$0")/.."

SESSION_SUMMARY="${1:-Сессия без описания}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
DATE_SHORT=$(date '+%Y-%m-%d')

echo "=========================================="
echo "  NPF Project - Завершение сессии"
echo "  $TIMESTAMP"
echo "=========================================="

# 1. Создаём бэкап
echo ""
echo "[1/4] Создание бэкапа..."
./scripts/backup.sh

# 2. Добавляем запись в SESSION_LOG.md
echo ""
echo "[2/4] Обновление лога сессий..."

if [ ! -f "./SESSION_LOG.md" ]; then
    cat > "./SESSION_LOG.md" << 'EOF'
# NPF Project - Лог сессий

Хронология работы над проектом.

---

EOF
fi

# Собираем статистику
ENTERPRISES=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM enterprises;" 2>/dev/null || echo "?")
INTERACTIONS=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM interactions;" 2>/dev/null || echo "?")
DOCUMENTS=$(sqlite3 ./db/npf.db "SELECT COUNT(*) FROM documents;" 2>/dev/null || echo "?")

# Добавляем запись
cat >> "./SESSION_LOG.md" << EOF

## $DATE_SHORT

**Время:** $TIMESTAMP

**Изменения:** $SESSION_SUMMARY

**Статистика данных:**
- Предприятий: $ENTERPRISES
- Взаимодействий: $INTERACTIONS
- Документов: $DOCUMENTS

---
EOF

echo "✓ Запись добавлена в SESSION_LOG.md"

# 3. Git коммит (если есть изменения)
echo ""
echo "[3/4] Git коммит..."

if git rev-parse --git-dir > /dev/null 2>&1; then
    CHANGES=$(git status --short | wc -l | tr -d ' ')
    if [ "$CHANGES" -gt 0 ]; then
        git add -A
        git commit -m "Session: $SESSION_SUMMARY

Date: $DATE_SHORT
Stats: $ENTERPRISES enterprises, $INTERACTIONS interactions, $DOCUMENTS documents"
        echo "✓ Изменения закоммичены"
    else
        echo "✓ Нет изменений для коммита"
    fi
else
    echo "⚠ Git не инициализирован"
fi

# 4. Напоминание
echo ""
echo "[4/4] Готово!"

echo ""
echo "=========================================="
echo "  Сессия завершена"
echo "=========================================="
echo ""
echo "При следующем запуске выполните:"
echo "  ./scripts/session-start.sh"
echo ""
echo "Или попросите Claude прочитать:"
echo "  CLAUDE_CONTEXT.md"
echo ""
