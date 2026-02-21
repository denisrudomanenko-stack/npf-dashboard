from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User, UserRole
from app.auth.security import verify_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials
    payload = verify_token(token)

    if payload is None:
        raise credentials_exception

    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def require_role(allowed_roles: List[UserRole]):
    """Create a dependency that checks if user has one of the allowed roles."""
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


async def require_admin(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_manager(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Require manager or admin role."""
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    return current_user


def check_ownership(entity, current_user: User) -> bool:
    """Check if user can edit/delete the entity.

    Returns True if:
    - User is Admin (can edit everything)
    - User is Manager AND owns the entity (created_by_id matches)

    Returns False if:
    - User is Viewer
    - User is Manager but doesn't own the entity
    - Entity has no owner (created_by_id is None) and user is not Admin
    """
    # Admin can edit everything
    if current_user.role == UserRole.ADMIN:
        return True

    # Manager can only edit their own entities
    if current_user.role == UserRole.MANAGER:
        # Check if entity has created_by_id attribute
        if not hasattr(entity, 'created_by_id'):
            return False
        # Old records without owner can only be edited by Admin
        if entity.created_by_id is None:
            return False
        return entity.created_by_id == current_user.id

    # Viewer cannot edit anything
    return False


def require_ownership(entity, current_user: User):
    """Raise 403 if user doesn't have permission to edit/delete the entity."""
    if not check_ownership(entity, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет прав на редактирование этой записи"
        )
