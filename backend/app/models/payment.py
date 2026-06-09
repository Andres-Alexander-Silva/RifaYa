import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, DateTime, Enum as SAEnum, ForeignKey, JSON, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class PaymentMethod(str, enum.Enum):
    wompi = "wompi"
    mercadopago = "mercadopago"
    cash = "cash"
    transfer = "transfer"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    failed = "failed"
    refunded = "refunded"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(SAEnum(PaymentMethod), nullable=False)
    status = Column(SAEnum(PaymentStatus), nullable=False, default=PaymentStatus.pending)

    gateway_reference = Column(String(255), nullable=True, index=True)
    gateway_response = Column(JSON, nullable=True)
    notes = Column(Text, nullable=True)
    receipt_url = Column(String(500), nullable=True)

    confirmed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    confirmed_by_user = relationship("User", back_populates="payments_confirmed", foreign_keys=[confirmed_by_id])
    tickets = relationship("Ticket", back_populates="payment", foreign_keys="Ticket.payment_id")


# Alias for clarity in imports (payment ↔ tickets is 1-to-many via Ticket.payment_id)
PaymentTicket = None  # kept for schema import compatibility
