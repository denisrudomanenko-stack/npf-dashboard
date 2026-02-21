#!/usr/bin/env python3
"""
Миграция данных из SQLite в PostgreSQL

Использование:
    python scripts/migrate_to_postgres.py

Переменные окружения:
    SQLITE_PATH - путь к SQLite базе (по умолчанию: ./db/npf.db)
    POSTGRES_URL - URL PostgreSQL (по умолчанию: postgresql://npf:npf_secure_password@localhost:5432/npf_db)
"""

import os
import sys
import sqlite3
from datetime import datetime

# Добавляем путь к backend для импорта моделей
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Ошибка: установите psycopg2-binary")
    print("pip install psycopg2-binary")
    sys.exit(1)

# Конфигурация
SQLITE_PATH = os.getenv("SQLITE_PATH", "./db/npf.db")
POSTGRES_URL = os.getenv("POSTGRES_URL", "postgresql://npf:npf_secure_password@localhost:5432/npf_db")

# Таблицы для миграции (в порядке зависимостей)
TABLES = [
    "enterprises",
    "interactions",
    "roadmap_items",
    "kpp_contracts",
    "documents",
    "conversations",
    "chat_messages",
    "llm_config",
    "milestones",
    "risks",
    "table_configs",
    "sales_data",
    "dashboard_configs",
]


def parse_postgres_url(url: str) -> dict:
    """Парсинг PostgreSQL URL."""
    # postgresql://user:password@host:port/dbname
    url = url.replace("postgresql://", "")
    user_pass, host_db = url.split("@")
    user, password = user_pass.split(":")
    host_port, dbname = host_db.split("/")

    if ":" in host_port:
        host, port = host_port.split(":")
    else:
        host, port = host_port, "5432"

    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": dbname,
    }


def get_sqlite_tables(sqlite_conn) -> list:
    """Получить список таблиц в SQLite."""
    cursor = sqlite_conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    return [row[0] for row in cursor.fetchall()]


def get_table_columns(sqlite_conn, table: str) -> list:
    """Получить колонки таблицы."""
    cursor = sqlite_conn.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cursor.fetchall()]


def migrate_table(sqlite_conn, pg_conn, table: str):
    """Мигрировать одну таблицу."""
    try:
        columns = get_table_columns(sqlite_conn, table)
        if not columns:
            print(f"  ⚠️  Таблица {table} не найдена в SQLite")
            return 0

        # Получаем данные из SQLite
        cursor = sqlite_conn.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()

        if not rows:
            print(f"  ℹ️  Таблица {table}: пусто")
            return 0

        # Очищаем таблицу в PostgreSQL
        pg_cursor = pg_conn.cursor()
        pg_cursor.execute(f"TRUNCATE TABLE {table} CASCADE")

        # Вставляем данные
        columns_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))

        insert_sql = f"INSERT INTO {table} ({columns_str}) VALUES ({placeholders})"

        for row in rows:
            # Конвертируем None и другие типы
            converted_row = []
            for val in row:
                if val == "":
                    converted_row.append(None)
                else:
                    converted_row.append(val)
            pg_cursor.execute(insert_sql, converted_row)

        # Обновляем sequence для id
        pg_cursor.execute(f"""
            SELECT setval(pg_get_serial_sequence('{table}', 'id'),
                         COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)
        """)

        pg_conn.commit()
        print(f"  ✅ {table}: {len(rows)} записей")
        return len(rows)

    except Exception as e:
        pg_conn.rollback()
        print(f"  ❌ {table}: ошибка - {e}")
        return 0


def main():
    print("=" * 50)
    print("Миграция SQLite → PostgreSQL")
    print("=" * 50)
    print(f"\nИсточник: {SQLITE_PATH}")
    print(f"Назначение: {POSTGRES_URL.split('@')[1] if '@' in POSTGRES_URL else POSTGRES_URL}")
    print()

    # Проверяем SQLite
    if not os.path.exists(SQLITE_PATH):
        print(f"❌ SQLite база не найдена: {SQLITE_PATH}")
        sys.exit(1)

    # Подключаемся к SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_tables = get_sqlite_tables(sqlite_conn)
    print(f"Таблиц в SQLite: {len(sqlite_tables)}")

    # Подключаемся к PostgreSQL
    try:
        pg_config = parse_postgres_url(POSTGRES_URL)
        pg_conn = psycopg2.connect(**pg_config)
        print("✅ Подключение к PostgreSQL успешно\n")
    except Exception as e:
        print(f"❌ Ошибка подключения к PostgreSQL: {e}")
        sys.exit(1)

    # Мигрируем таблицы
    total_records = 0
    print("Миграция таблиц:")
    for table in TABLES:
        if table in sqlite_tables:
            count = migrate_table(sqlite_conn, pg_conn, table)
            total_records += count
        else:
            print(f"  ⚠️  {table}: не существует в SQLite")

    # Закрываем соединения
    sqlite_conn.close()
    pg_conn.close()

    print()
    print("=" * 50)
    print(f"✅ Миграция завершена: {total_records} записей")
    print("=" * 50)


if __name__ == "__main__":
    main()
