"""
Authentication and Role-Based Authorization service for HAZARDGUARD.
Roles:
- ADMIN (Full system and settings write access)
- SAFETY_OPERATIONS (Operational monitoring, incident lifecycle, read dashboard)
- VIEWER (Read-only access across all views)
"""

import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import User, AuditLog

SECRET_KEY = os.getenv("JWT_SECRET", "hazardguard_enterprise_secret_key_2026_secured")
security = HTTPBearer(auto_error=False)

# Simple secure token cache (token -> {user_id, username, role, expires_at})
_SESSION_STORE: Dict[str, Dict[str, Any]] = {}


def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with salt."""
    if not salt:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hex = stored_hash.split('$', 1)
        actual_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(actual_key.hex(), expected_hex)
    except Exception:
        return False


def create_access_token(user: User) -> str:
    token = secrets.token_urlsafe(32)
    _SESSION_STORE[token] = {
        "user_id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "expires_at": datetime.utcnow() + timedelta(days=7)
    }
    return token


def get_session_by_token(token: str) -> Optional[Dict[str, Any]]:
    session_data = _SESSION_STORE.get(token)
    if not session_data:
        return None
    if session_data["expires_at"] < datetime.utcnow():
        del _SESSION_STORE[token]
        return None
    return session_data


def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Optional[Dict[str, Any]]:
    if not credentials:
        return None
    return get_session_by_token(credentials.credentials)


def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)) -> Dict[str, Any]:
    user = get_current_user_optional(credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in."
        )
    return user


def require_role(allowed_roles: list[str]):
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)):
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Role '{current_user['role']}' does not have permission for this action."
            )
        return current_user
    return role_checker


def log_audit_event(db: Session, user: Dict[str, Any], action: str, target: str, notes: str = "", outcome: str = "SUCCESS"):
    """Persist privileged action in the audit log table."""
    try:
        audit = AuditLog(
            user_id=user.get("user_id"),
            username=user.get("username", "anonymous"),
            role=user.get("role", "UNKNOWN"),
            action=action,
            target=target,
            notes=notes,
            outcome=outcome,
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        print("Audit log write error:", e)
