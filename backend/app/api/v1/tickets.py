from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response
from app.core.limiter import limiter
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from datetime import datetime, timedelta, timezone
import io
from app.database import get_db
from app.api.deps import get_current_user, require_seller_or_admin
from app.core.config import settings
from app.models.raffle import Raffle, RaffleStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User
from app.schemas.ticket import TicketOut, TicketReserve, TicketBulkReserve, TicketPublic
from app.tasks.reservations import expire_reservation
from app.api.v1.ws import manager as ws_manager


async def _broadcast_tickets(raffle_id: str, tickets: list) -> None:
    await ws_manager.broadcast(raffle_id, {
        "type": "tickets_updated",
        "tickets": [{"id": str(t.id), "number": t.number, "status": t.status.value} for t in tickets],
    })

router = APIRouter(prefix="/raffles/{raffle_id}/tickets", tags=["Boletos"])


def _get_active_raffle(raffle_id: UUID, db: Session) -> Raffle:
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    if raffle.status != RaffleStatus.active:
        raise HTTPException(status_code=400, detail="La rifa no está activa")
    return raffle


@router.get("", response_model=list[TicketPublic])
def list_tickets(raffle_id: UUID, db: Session = Depends(get_db)):
    tickets = db.query(Ticket).filter(Ticket.raffle_id == raffle_id).order_by(Ticket.number).all()
    return tickets


@router.get("/search/{number}", response_model=TicketOut)
def search_ticket(raffle_id: UUID, number: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(
        and_(Ticket.raffle_id == raffle_id, Ticket.number == number)
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Boleto no encontrado")
    return ticket


@router.post("/reserve", response_model=TicketOut)
@limiter.limit("30/minute")
def reserve_ticket(request: Request, raffle_id: UUID, payload: TicketReserve, db: Session = Depends(get_db), background_tasks: BackgroundTasks = None):
    raffle = _get_active_raffle(raffle_id, db)
    ticket = db.query(Ticket).filter(
        and_(Ticket.raffle_id == raffle_id, Ticket.number == payload.ticket_number)
    ).with_for_update().first()

    if not ticket:
        raise HTTPException(status_code=404, detail="Número no existe en esta rifa")
    if ticket.status != TicketStatus.available:
        raise HTTPException(status_code=409, detail="El boleto no está disponible")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.RESERVATION_MINUTES)
    ticket.status = TicketStatus.reserved
    ticket.buyer_name = payload.buyer_name
    ticket.buyer_phone = payload.buyer_phone
    ticket.buyer_email = payload.buyer_email
    ticket.reserved_at = datetime.now(timezone.utc)
    ticket.reservation_expires_at = expires_at
    db.commit()
    db.refresh(ticket)

    expire_reservation.apply_async(args=[str(ticket.id)], countdown=settings.RESERVATION_MINUTES * 60)
    if background_tasks:
        background_tasks.add_task(_broadcast_tickets, str(raffle_id), [ticket])
    return ticket


@router.post("/reserve-bulk", response_model=list[TicketOut])
@limiter.limit("10/minute")
def reserve_tickets_bulk(request: Request, raffle_id: UUID, payload: TicketBulkReserve, db: Session = Depends(get_db), background_tasks: BackgroundTasks = None):
    _get_active_raffle(raffle_id, db)

    if payload.specific_numbers:
        tickets = (
            db.query(Ticket)
            .filter(and_(Ticket.raffle_id == raffle_id, Ticket.number.in_(payload.specific_numbers)))
            .with_for_update()
            .all()
        )
    else:
        tickets = (
            db.query(Ticket)
            .filter(and_(Ticket.raffle_id == raffle_id, Ticket.status == TicketStatus.available))
            .limit(payload.quantity)
            .with_for_update()
            .all()
        )

    unavailable = [t.number for t in tickets if t.status != TicketStatus.available]
    if unavailable:
        raise HTTPException(status_code=409, detail=f"Boletos no disponibles: {unavailable}")
    if len(tickets) < payload.quantity:
        raise HTTPException(status_code=409, detail="No hay suficientes boletos disponibles")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.RESERVATION_MINUTES)
    now = datetime.now(timezone.utc)
    for ticket in tickets:
        ticket.status = TicketStatus.reserved
        ticket.buyer_name = payload.buyer_name
        ticket.buyer_phone = payload.buyer_phone
        ticket.buyer_email = payload.buyer_email
        ticket.reserved_at = now
        ticket.reservation_expires_at = expires_at
        expire_reservation.apply_async(args=[str(ticket.id)], countdown=settings.RESERVATION_MINUTES * 60)

    db.commit()
    if background_tasks:
        background_tasks.add_task(_broadcast_tickets, str(raffle_id), tickets)
    return tickets


@router.get("/admin", response_model=list[TicketOut])
def list_tickets_admin(
    raffle_id: UUID,
    status: TicketStatus | None = None,
    db: Session = Depends(get_db),
    _=Depends(require_seller_or_admin),
):
    q = db.query(Ticket).filter(Ticket.raffle_id == raffle_id)
    if status:
        q = q.filter(Ticket.status == status)
    return q.order_by(Ticket.number).all()
