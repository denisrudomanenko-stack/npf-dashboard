#!/bin/bash

# NPF Development - Quick Start
# Двойной клик для запуска приложения

# Переходим в директорию скрипта
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_DIR="$SCRIPT_DIR/backend"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
PORT=8001

echo "========================================"
echo "   NPF Development - Запуск сервера"
echo "========================================"
echo ""
echo "Директория: $SCRIPT_DIR"
echo ""

# Проверяем наличие venv
if [ ! -f "$VENV_PYTHON" ]; then
    echo "ОШИБКА: Виртуальное окружение не найдено!"
    echo "Путь: $VENV_PYTHON"
    echo ""
    echo "Нажмите Enter для выхода..."
    read
    exit 1
fi

# Проверяем, занят ли порт
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "Сервер уже запущен на порту $PORT"
    echo "Открываю браузер..."
    open "http://127.0.0.1:$PORT"
    echo ""
    echo "Нажмите Enter для выхода..."
    read
    exit 0
fi

echo "Запуск backend сервера на порту $PORT..."
cd "$BACKEND_DIR"

# Запускаем сервер
"$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port $PORT &
SERVER_PID=$!

echo "Ожидание запуска (PID: $SERVER_PID)..."
for i in {1..20}; do
    if curl -s "http://127.0.0.1:$PORT/health" > /dev/null 2>&1; then
        echo ""
        echo "Сервер успешно запущен!"
        echo "URL: http://127.0.0.1:$PORT"
        echo ""
        open "http://127.0.0.1:$PORT"
        echo "========================================"
        echo "Сервер работает. Закройте это окно"
        echo "для остановки сервера."
        echo "========================================"
        echo ""
        wait $SERVER_PID
        exit 0
    fi
    sleep 0.5
    echo -n "."
done

echo ""
echo "Ошибка: Не удалось запустить сервер"
echo "Проверьте, что порт $PORT свободен"
echo ""
echo "Нажмите Enter для выхода..."
read
