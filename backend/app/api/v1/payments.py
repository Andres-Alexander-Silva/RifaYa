from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Header
from app.core.limiter import limiter
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
import hashlib
import hmac
from app.database import get_db
from app.api.deps import get_current_user, require_seller_or_admin
from app.core.config import settings
from app.models.ticket import Ticket, TicketStatus
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.user import User
from app.schemas.payment import PaymentCreate, PaymentOut, PaymentConfirm, PaymentManual, PublicPaymentSubmit
from app.tasks.notifications import notify_payment_confirmed, notify_admin_new_payment
from app.api.v1.ws import manager as ws_manager


async def _broadcast_paid(tickets: list) -> None:
    if not tickets:
        return
    raffle_id = str(tickets[0].raffle_id)
    await ws_manager.broadcast(raffle_id, {
        "type": "tickets_updated",
        "tickets": [{"id": str(t.id), "number": t.number, "status": "paid"} for t in tickets],
    })

router = APIRouter(prefix="/payments", tags=["Pagos"])


def _validate_tickets(ticket_ids: list[UUID], db: Session) -> list[Ticket]:
    tickets = db.query(Ticket).filter(Ticket.id.in_(ticket_ids)).all()
    if len(tickets) != len(ticket_ids):
        raise HTTPException(status_code=404, detail="Uno o más boletos no encontrados")
    non_reserved = [t.number for t in tickets if t.status != TicketStatus.reserved]
    if non_reserved:
        raise HTTPException(status_code=409, detail=f"Boletos no en estado reservado: {non_reserved}")
    return tickets


@router.post("/public-submit", response_model=PaymentOut, status_code=201)
@limiter.limit("10/minute")
def submit_public_payment(request: Request, payload: PublicPaymentSubmit, db: Session = Depends(get_db)):
    """Endpoint público — el comprador envía su comprobante de pago."""
    tickets = db.query(Ticket).filter(Ticket.id.in_(payload.ticket_ids)).all()
    if len(tickets) != len(payload.ticket_ids):
        raise HTTPException(status_code=404, detail="Uno o más boletos no encontrados")
    non_reserved = [t.number for t in tickets if t.status != TicketStatus.reserved]
    if non_reserved:
        raise HTTPException(status_code=409, detail=f"Boletos no en estado reservado: {non_reserved}")

    payment = Payment(
        amount=payload.amount,
        method=payload.method,
        status=PaymentStatus.pending,
        receipt_url=payload.receipt_url,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()
    for ticket in tickets:
        ticket.payment_id = payment.id
    db.commit()
    db.refresh(payment)
    notify_admin_new_payment.delay(payment_id=str(payment.id))
    return _enrich(payment, tickets)


@router.post("/manual", response_model=PaymentOut, status_code=201)
def create_manual_payment(
    payload: PaymentManual,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller_or_admin),
):
    tickets = _validate_tickets(payload.ticket_ids, db)
    payment = Payment(
        amount=payload.amount,
        method=payload.method,
        status=PaymentStatus.pending,
        notes=payload.notes,
        receipt_url=payload.receipt_url,
    )
    db.add(payment)
    db.flush()
    for ticket in tickets:
        ticket.payment_id = payment.id
    db.commit()
    db.refresh(payment)
    return _enrich(payment, tickets)


@router.post("/{payment_id}/confirm", response_model=PaymentOut)
def confirm_payment(
    payment_id: UUID,
    payload: PaymentConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller_or_admin),
    background_tasks: BackgroundTasks = None,
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    if payment.status == PaymentStatus.confirmed:
        raise HTTPException(status_code=400, detail="Pago ya confirmado")

    now = datetime.now(timezone.utc)
    payment.status = PaymentStatus.confirmed
    payment.confirmed_by_id = current_user.id
    payment.confirmed_at = now
    if payload.notes:
        payment.notes = payload.notes

    tickets = db.query(Ticket).filter(Ticket.payment_id == payment_id).all()
    for ticket in tickets:
        ticket.status = TicketStatus.paid
        ticket.paid_at = now

    db.commit()
    db.refresh(payment)
    notify_payment_confirmed.delay(payment_id=str(payment_id))
    if background_tasks:
        background_tasks.add_task(_broadcast_paid, tickets)
    return _enrich(payment, tickets)


@router.get("", response_model=list[PaymentOut])
def list_payments(
    status: PaymentStatus | None = None,
    raffle_id: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_seller_or_admin),
):
    q = db.query(Payment)
    if status:
        q = q.filter(Payment.status == status)
    if raffle_id:
        q = q.join(Ticket, Ticket.payment_id == Payment.id).filter(Ticket.raffle_id == raffle_id).distinct()
    payments = q.order_by(Payment.created_at.desc()).offset(skip).limit(limit).all()
    return [_enrich(p, p.tickets) for p in payments]


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: UUID, db: Session = Depends(get_db), _=Depends(require_seller_or_admin)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    return _enrich(payment, payment.tickets)


# ── Webhooks ──────────────────────────────────────────────────────────────────

@router.post("/webhooks/wompi", include_in_schema=False)
async def wompi_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    data = await request.json()
    # Verify Wompi signature
    checksum = data.get("signature", {}).get("checksum", "")
    properties = data.get("signature", {}).get("properties", [])
    event_data = data.get("data", {})
    concat = "".join(str(event_data.get(p, "")) for p in properties)
    concat += settings.WOMPI_EVENTS_SECRET
    expected = hashlib.sha256(concat.encode()).hexdigest()
    if not hmac.compare_digest(checksum, expected):
        raise HTTPException(status_code=400, detail="Firma inválida")

    transaction = event_data.get("transaction", {})
    ref = transaction.get("reference")
    wompi_status = transaction.get("status")

    payment = db.query(Payment).filter(Payment.gateway_reference == ref).first()
    if payment and wompi_status == "APPROVED" and payment.status != PaymentStatus.confirmed:
        now = datetime.now(timezone.utc)
        payment.status = PaymentStatus.confirmed
        payment.confirmed_at = now
        payment.gateway_response = transaction
        for ticket in payment.tickets:
            ticket.status = TicketStatus.paid
            ticket.paid_at = now
        db.commit()
        notify_payment_confirmed.delay(payment_id=str(payment.id))
    return {"ok": True}


@router.post("/webhooks/mercadopago", include_in_schema=False)
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    if data.get("type") == "payment":
        payment_id_mp = data["data"]["id"]
        payment = db.query(Payment).filter(Payment.gateway_reference == str(payment_id_mp)).first()
        if payment and payment.status != PaymentStatus.confirmed:
            now = datetime.now(timezone.utc)
            payment.status = PaymentStatus.confirmed
            payment.confirmed_at = now
            for ticket in payment.tickets:
                ticket.status = TicketStatus.paid
                ticket.paid_at = now
            db.commit()
            notify_payment_confirmed.delay(payment_id=str(payment.id))
    return {"ok": True}


def _enrich(payment: Payment, tickets: list[Ticket]) -> PaymentOut:
    out = PaymentOut.model_validate(payment)
    out.ticket_ids = [t.id for t in tickets]
    if payment.confirmed_by_user:
        out.confirmed_by_name = payment.confirmed_by_user.full_name
    return out
