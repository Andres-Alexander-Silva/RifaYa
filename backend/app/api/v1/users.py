from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.api.deps import get_current_user, require_admin
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.full_name:
        current_user.full_name = payload.full_name
    if payload.phone:
        current_user.phone = payload.phone
    if payload.password:
        current_user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("", response_model=list[UserOut])
def list_users(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), _=Depends(require_admin)):
    return db.query(User).offset(skip).limit(limit).all()


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: UUID, payload: UserUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.full_name:
        user.full_name = payload.full_name
    if payload.phone:
        user.phone = payload.phone
    if payload.password:
        user.hashed_password = get_password_hash(payload.password)
    db.commit()
    db.refresh(user)
    return user
