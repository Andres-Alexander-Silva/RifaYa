from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class DrawResult(BaseModel):
    winning_number: int
    winning_ticket_id: UUID
    buyer_name: str
    buyer_phone: str | None = None
    buyer_email: str | None = None
    has_winner: bool = True


class DrawOut(BaseModel):
    id: UUID
    raffle_id: UUID
    winning_ticket_id: UUID
    drawn_at: datetime
    conducted_by_id: UUID
    conducted_by_name: str | None = None
    certificate_url: str | None = None
    algorithm: str
    result: DrawResult | None = None

    model_config = {"from_attributes": True}
