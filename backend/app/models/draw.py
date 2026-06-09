import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class Draw(Base):
    __tablename__ = "draws"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raffle_id = Column(UUID(as_uuid=True), ForeignKey("raffles.id"), nullable=False, unique=True, index=True)
    winning_ticket_id = Column(UUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False)
    drawn_at = Column(DateTime(timezone=True), nullable=False)
    conducted_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    certificate_url = Column(String(500), nullable=True)
    algorithm = Column(String(50), nullable=False, default="secure_random")

    raffle = relationship("Raffle", back_populates="draw")
    winning_ticket = relationship("Ticket", foreign_keys=[winning_ticket_id])
    conducted_by_user = relationship("User", back_populates="draws_conducted", foreign_keys=[conducted_by_id])
