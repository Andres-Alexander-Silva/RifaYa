import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class TicketStatus(str, enum.Enum):
    available = "available"
    reserved = "reserved"
    paid = "paid"
    cancelled = "cancelled"


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id = Column(UUID(as_uuid=True), ForeignKey("raffles.id"), nullable=False, index=True)
    number = Column(Integer, nullable=False)
    status = Column(SAEnum(TicketStatus), nullable=False, default=TicketStatus.available)

    buyer_name = Column(String(255), nullable=True)
    buyer_phone = Column(String(30), nullable=True)
    buyer_email = Column(String(255), nullable=True)

    reserved_at = Column(DateTime(timezone=True), nullable=True)
    reservation_expires_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    payment_id = Column(UUID(as_uuid=True), ForeignKey("payments.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    raffle = relationship("Raffle", back_populates="tickets", foreign_keys=[raffle_id])
    payment = relationship("Payment", back_populates="tickets", foreign_keys=[payment_id])

    __table_args__ = (
        # unique ticket number per raffle enforced at DB level
        __import__("sqlalchemy").UniqueConstraint("raffle_id", "number", name="uq_raffle_ticket_number"),
    )
