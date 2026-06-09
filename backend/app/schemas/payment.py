from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from app.models.payment import PaymentMethod, PaymentStatus


class PaymentCreate(BaseModel):
    ticket_ids: list[UUID]
    method: PaymentMethod
    amount: Decimal


class PaymentManual(BaseModel):
    ticket_ids: list[UUID]
    method: PaymentMethod
    amount: Decimal
    notes: str | None = None
    receipt_url: str | None = None


class PaymentConfirm(BaseModel):
    notes: str | None = None


class PublicPaymentSubmit(BaseModel):
    ticket_ids: list[UUID]
    method: PaymentMethod
    amount: Decimal
    receipt_url: str | None = None
    notes: str | None = None


class PaymentOut(BaseModel):
    id: UUID
    amount: Decimal
    method: PaymentMethod
    status: PaymentStatus
    gateway_reference: str | None = None
    notes: str | None = None
    receipt_url: str | None = None
    confirmed_by_id: UUID | None = None
    confirmed_by_name: str | None = None
    confirmed_at: datetime | None = None
    created_at: datetime
    ticket_ids: list[UUID] = []

    model_config = {"from_attributes": True}


class WompiWebhook(BaseModel):
    event: str
    data: dict
    environment: str
    signature: dict


class MercadoPagoWebhook(BaseModel):
    id: int
    live_mode: bool
    type: str
    date_created: str
    data: dict
