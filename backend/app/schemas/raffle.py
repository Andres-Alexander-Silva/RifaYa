from pydantic import BaseModel, field_validator
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.models.raffle import RaffleStatus, NumberingType


class RaffleBase(BaseModel):
    title: str
    description: str | None = None
    prize_description: str
    prize_images: list[str] = []
    ticket_price: Decimal
    total_tickets: int
    draw_date: datetime
    numbering_type: NumberingType = NumberingType.auto
    lottery_slug: str | None = None
    lottery_digits: int | None = None  # 2 or 3

    @field_validator("total_tickets")
    @classmethod
    def validate_tickets(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Debe haber al menos 1 boleto")
        if v > 100_000:
            raise ValueError("No puede exceder 100,000 boletos")
        return v

    @field_validator("ticket_price")
    @classmethod
    def validate_price(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("El precio debe ser mayor a 0")
        return v


class RaffleCreate(RaffleBase):
    pass


class RaffleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    prize_description: str | None = None
    prize_images: list[str] | None = None
    ticket_price: Decimal | None = None
    draw_date: datetime | None = None
    status: RaffleStatus | None = None
    is_visible: bool | None = None


class RaffleStats(BaseModel):
    total: int
    available: int
    reserved: int
    paid: int
    revenue: float
    target: float
    progress_pct: float


class RaffleOut(RaffleBase):
    id: UUID
    slug: str
    status: RaffleStatus
    is_visible: bool
    created_by_id: UUID
    winner_ticket_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    stats: RaffleStats | None = None

    model_config = {"from_attributes": True}


class RafflePublic(BaseModel):
    id: UUID
    slug: str
    title: str
    description: str | None = None
    prize_description: str
    prize_images: list[str]
    ticket_price: Decimal
    total_tickets: int
    draw_date: datetime
    status: RaffleStatus
    winner_ticket_id: UUID | None = None
    lottery_slug: str | None = None
    lottery_digits: int | None = None
    stats: RaffleStats | None = None

    model_config = {"from_attributes": True}
