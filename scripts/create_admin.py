#!/usr/bin/env python3
"""
Script to create the first admin user.
Run from the backend directory: python scripts/create_admin.py

Usage:
  Interactive:  python scripts/create_admin.py
  With args:    python scripts/create_admin.py --username admin --email admin@example.com --password secret123
"""

import asyncio
import sys
import os
import getpass
import argparse

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from app.database import Base
from app.models.user import User, UserRole
from app.auth.security import hash_password


async def create_admin(username: str = None, email: str = None, password: str = None, force: bool = False):
    """Create admin user."""
    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./npf.db")

    print("\n=== NPF Admin User Creation ===\n")
    print(f"Database: {database_url.split('@')[-1] if '@' in database_url else database_url}")

    # Create engine
    if database_url.startswith("postgresql"):
        engine = create_async_engine(database_url, pool_pre_ping=True)
    else:
        engine = create_async_engine(database_url)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create tables if needed
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # Check if admin already exists
        result = await db.execute(select(User).where(User.role == UserRole.ADMIN))
        existing_admin = result.scalar_one_or_none()

        if existing_admin and not force:
            print(f"\n⚠️  Admin user already exists: {existing_admin.username}")
            if username is None:  # Interactive mode
                confirm = input("Create another admin? (y/N): ").strip().lower()
                if confirm != 'y':
                    print("Cancelled.")
                    await engine.dispose()
                    return
            else:
                print("Use --force to create another admin.")
                await engine.dispose()
                return

        # Get credentials - interactive or from args
        if username is None:
            print("\nEnter admin credentials:\n")
            username = input("Username: ").strip()

        if not username or len(username) < 3:
            print("Error: Username must be at least 3 characters")
            await engine.dispose()
            return

        # Check if username exists
        result = await db.execute(select(User).where(User.username == username))
        if result.scalar_one_or_none():
            print(f"Error: Username '{username}' already exists")
            await engine.dispose()
            return

        if email is None:
            email = input("Email: ").strip()

        if not email or '@' not in email:
            print("Error: Invalid email")
            await engine.dispose()
            return

        # Check if email exists
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            print(f"Error: Email '{email}' already exists")
            await engine.dispose()
            return

        if password is None:
            password = getpass.getpass("Password (min 6 chars): ")
            password_confirm = getpass.getpass("Confirm password: ")
            if password != password_confirm:
                print("Error: Passwords do not match")
                await engine.dispose()
                return

        if len(password) < 6:
            print("Error: Password must be at least 6 characters")
            await engine.dispose()
            return

        # Create admin user
        admin = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role=UserRole.ADMIN,
            is_active=True
        )

        db.add(admin)
        await db.commit()
        await db.refresh(admin)

        print(f"\n✅ Admin user created successfully!")
        print(f"   Username: {admin.username}")
        print(f"   Email: {admin.email}")
        print(f"   Role: {admin.role.value}")
        print(f"\nYou can now login at /api/v1/auth/login\n")

    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create NPF admin user")
    parser.add_argument("--username", "-u", help="Admin username")
    parser.add_argument("--email", "-e", help="Admin email")
    parser.add_argument("--password", "-p", help="Admin password")
    parser.add_argument("--force", "-f", action="store_true", help="Create even if admin exists")

    args = parser.parse_args()

    asyncio.run(create_admin(
        username=args.username,
        email=args.email,
        password=args.password,
        force=args.force
    ))
