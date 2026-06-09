from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.core.limiter import limiter
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, create_refresh_token, verify_token,
    create_password_reset_token, verify_password_reset_token,
)
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserLogin, Token, TokenRefresh
from app.services.email import send_password_reset

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Cuenta inactiva")
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=Token)
def refresh_token(payload: TokenRefresh, db: Session = Depends(get_db)):
    data = verify_token(payload.refresh_token)
    if not data or data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")
    user = db.query(User).filter(User.id == data["sub"]).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return Token(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Siempre responde 200 para no revelar si el email existe o no
    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.is_active:
        token = create_password_reset_token(str(user.id))
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        send_password_reset(user.email, reset_link, user.full_name)
    return {"detail": "Si el email existe, recibirás un enlace para restablecer tu contraseña."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    user_id = verify_password_reset_token(payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="El enlace es inválido o ya expiró")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Usuario no encontrado")
    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"detail": "Contraseña actualizada correctamente"}
