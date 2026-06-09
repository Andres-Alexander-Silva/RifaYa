from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from app.models.ticket import TicketStatus


class TicketBuyerInfo(BaseModel):
    buyer_name: str
    buyer_phone: str
    buyer_email: str | None = None


class TicketReserve(TicketBuyerInfo):
    ticket_number: int


class TicketBulkReserve(TicketBuyerInfo):
    quantity: int
    specific_numbers: list[int] | None = None  # None = auto-assign


class TicketOut(BaseModel):
    id: UUID
    raffle_id: UUID
    number: int
    status: TicketStatus
    buyer_name: str | None = None
    buyer_phone: str | None = None
    buyer_email: str | None = None
    reserved_at: datetime | None = None
    reservation_expires_at: datetime | None = None
    paid_at: datetime | None = None
    payment_id: UUID | None = None

    model_config = {"from_attributes": True}


class TicketPublic(BaseModel):
    number: int
    status: TicketStatus
    buyer_name: str | None = None

    model_config = {"from_attributes": True}
