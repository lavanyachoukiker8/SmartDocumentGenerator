import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models import UserTable


def get_jwt_secret() -> str:
    return settings.JWT_SECRET_KEY or settings.FERNET_KEY or "clubdocs-secure-jwt-key"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"{salt.hex()}:{dk.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, dk_hex = hashed.split(":")
        salt = bytes.fromhex(salt_hex)
        expected_dk = bytes.fromhex(dk_hex)
        actual_dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(expected_dk, actual_dk)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=settings.JWT_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


security = HTTPBearer(auto_error=False)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def get_current_user_optional(
    creds: Optional[HTTPAuthorizationCredentials] = Security(security),
    session: Session = Depends(get_session),
) -> Optional[UserTable]:
    if not creds:
        return None
    try:
        payload = decode_access_token(creds.credentials)
        username: str = payload.get("sub")
        if not username:
            return None
        user = session.exec(select(UserTable).where(UserTable.username == username)).first()
        return user
    except HTTPException:
        return None


def get_current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Security(security),
    session: Session = Depends(get_session),
) -> UserTable:
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(creds.credentials)
    username: str = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )
    user = session.exec(select(UserTable).where(UserTable.username == username)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_role(allowed_roles: List[str]):
    def role_checker(
        creds: Optional[HTTPAuthorizationCredentials] = Security(security),
        session: Session = Depends(get_session),
    ) -> UserTable:
        if not creds:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )
        user = get_current_user(creds, session)
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: role '{user.role}' lacks permission. Required: {allowed_roles}",
            )
        return user

    return role_checker


def seed_default_users(session: Session):
    existing = session.exec(select(UserTable)).first()
    if not existing:
        defaults = [
            ("user-admin", "admin", "admin123", "admin", "Club Admin"),
            ("user-member", "member", "member123", "member", "ACM Member"),
            ("user-faculty", "faculty", "faculty123", "faculty", "Dr. Sankita J. Patel"),
        ]
        for uid, username, pwd, role, full_name in defaults:
            user = UserTable(
                id=uid,
                username=username,
                password_hash=hash_password(pwd),
                role=role,
                full_name=full_name,
            )
            session.add(user)
        session.commit()
