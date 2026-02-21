#!/bin/bash
set -e

# Create initial admin user if INIT_ADMIN_* variables are set
if [ -n "$INIT_ADMIN_USERNAME" ] && [ -n "$INIT_ADMIN_EMAIL" ] && [ -n "$INIT_ADMIN_PASSWORD" ]; then
    echo "Creating initial admin user..."
    python3 -c "
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.database import Base
from app.models.user import User, UserRole
from app.auth.security import hash_password
import os

async def create_admin():
    database_url = os.getenv('DATABASE_URL')
    engine = create_async_engine(database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.username == '$INIT_ADMIN_USERNAME'))
        if result.scalar_one_or_none():
            print('Admin user already exists, skipping...')
            return

        admin = User(
            username='$INIT_ADMIN_USERNAME',
            email='$INIT_ADMIN_EMAIL',
            hashed_password=hash_password('$INIT_ADMIN_PASSWORD'),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin)
        await db.commit()
        print(f'Admin user created: $INIT_ADMIN_USERNAME')

    await engine.dispose()

asyncio.run(create_admin())
" 2>&1 || echo "Warning: Could not create admin user"
fi

echo "Starting FastAPI application (development mode)..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
