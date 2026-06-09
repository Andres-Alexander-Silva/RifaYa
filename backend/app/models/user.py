import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    seller = "seller"
    buyer = "buyer"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(30), nullable=True)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.buyer)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    raffles_created = relationship("Raffle", back_populates="creator", foreign_keys="Raffle.created_by_id")
    payments_confirmed = relationship("Payment", back_populates="confirmed_by_user", foreign_keys="Payment.confirmed_by_id")
    draws_conducted = relationship("Draw", back_populates="conducted_by_user", foreign_keys="Draw.conducted_by_id")
