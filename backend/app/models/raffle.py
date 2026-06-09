import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, Boolean, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class RaffleStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"
    drawn = "drawn"


class NumberingType(str, enum.Enum):
    auto = "auto"
    manual = "manual"


class Raffle(Base):
    __tablename__ = "raffles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    prize_description = Column(Text, nullable=False)
    prize_images = Column(JSON, default=list)  # list of image URLs
    ticket_price = Column(Numeric(12, 2), nullable=False)
    total_tickets = Column(Integer, nullable=False)
    draw_date = Column(DateTime(timezone=True), nullable=False)
    status = Column(SAEnum(RaffleStatus), nullable=False, default=RaffleStatus.draft)
    is_visible = Column(Boolean, nullable=False, default=True)
    numbering_type = Column(SAEnum(NumberingType), nullable=False, default=NumberingType.auto)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    lottery_slug = Column(String(100), nullable=True)
    lottery_digits = Column(Integer, nullable=True)  # 2 or 3

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    winner_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    creator = relationship("User", back_populates="raffles_created", foreign_keys=[created_by_id])
    tickets = relationship("Ticket", back_populates="raffle", foreign_keys="Ticket.raffle_id", cascade="all, delete-orphan")
    winner_ticket = relationship("Ticket", foreign_keys=[winner_ticket_id], post_update=True)
    draw = relationship("Draw", back_populates="raffle", uselist=False)
