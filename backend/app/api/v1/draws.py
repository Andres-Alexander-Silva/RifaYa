import secrets
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
import tempfile
from app.database import get_db
from app.api.deps import require_admin
from app.models.raffle import Raffle, RaffleStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.draw import Draw
from app.models.payment import Payment, PaymentStatus
from app.models.user import User
from app.schemas.draw import DrawOut, DrawResult
from app.services.pdf import generate_draw_certificate
from app.services.lottery import get_result_by_date_and_slug, extract_winning_number
from app.tasks.notifications import notify_winner

router = APIRouter(prefix="/raffles/{raffle_id}/draw", tags=["Sorteo"])


class DrawRequest(BaseModel):
    lottery_date: str | None = None  # YYYY-MM-DD, only required for lottery raffles


@router.post("", response_model=DrawOut)
def conduct_draw(
    raffle_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
    body: DrawRequest = Body(default=DrawRequest()),
):
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    allowed = (RaffleStatus.closed, RaffleStatus.drawn)
    if raffle.lottery_slug:
        allowed = (RaffleStatus.active, RaffleStatus.closed, RaffleStatus.drawn)
    if raffle.status not in allowed:
        raise HTTPException(status_code=400, detail="La rifa debe estar cerrada para sortear")
    pending_count = (
        db.query(Payment)
        .join(Ticket, Ticket.payment_id == Payment.id)
        .filter(Ticket.raffle_id == raffle_id, Payment.status == PaymentStatus.pending)
        .count()
    )
    if pending_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Hay {pending_count} pago(s) pendientes de confirmar. Revisa y confirma todos los pagos antes de realizar el sorteo.",
        )

    if raffle.draw:
        if raffle.draw.winning_ticket.status == TicketStatus.paid:
            raise HTTPException(status_code=400, detail="Ya se realizó el sorteo con un ganador confirmado")
        db.delete(raffle.draw)
        db.flush()

    if raffle.lottery_slug:
        # ── Lottery mode ────────────────────────────────────────────────────────
        lottery_date = body.lottery_date or raffle.draw_date.date().isoformat()
        digits = raffle.lottery_digits or 3

        try:
            result_raw = get_result_by_date_and_slug(lottery_date, raffle.lottery_slug)
        except Exception:
            raise HTTPException(status_code=503, detail="No se pudo consultar el resultado de la lotería. Intenta de nuevo.")

        if result_raw is None:
            raise HTTPException(
                status_code=404,
                detail=f"No hay resultado de '{raffle.lottery_slug}' para el {lottery_date}. Puede que aún no haya salido.",
            )

        winning_number_int = extract_winning_number(result_raw, digits)

        winning_ticket = db.query(Ticket).filter(
            Ticket.raffle_id == raffle_id,
            Ticket.number == winning_number_int,
        ).first()

        if winning_ticket is None:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El número ganador {winning_number_int:0{digits}d} (últimos {digits} dígitos de '{result_raw}') "
                    f"no existe en esta rifa. Los boletos van del 1 al {raffle.total_tickets}."
                ),
            )

        is_paid = winning_ticket.status == TicketStatus.paid
        algorithm = f"lottery:{raffle.lottery_slug}:{lottery_date}"
        if raffle.status == RaffleStatus.active:
            raffle.status = RaffleStatus.closed
    else:
        # ── Random mode ─────────────────────────────────────────────────────────
        all_tickets = db.query(Ticket).filter(Ticket.raffle_id == raffle_id).all()
        if not all_tickets:
            raise HTTPException(status_code=400, detail="Esta rifa no tiene boletos registrados")
        winning_ticket = secrets.choice(all_tickets)
        is_paid = winning_ticket.status == TicketStatus.paid
        algorithm = "secrets.choice"

    now = datetime.now(timezone.utc)
    draw = Draw(
        raffle_id=raffle_id,
        winning_ticket_id=winning_ticket.id,
        drawn_at=now,
        conducted_by_id=current_user.id,
        algorithm=algorithm,
    )
    db.add(draw)
    raffle.status = RaffleStatus.drawn
    raffle.winner_ticket_id = winning_ticket.id if is_paid else None
    db.commit()
    db.refresh(draw)

    if is_paid:
        notify_winner.delay(draw_id=str(draw.id))

    result = DrawResult(
        winning_number=winning_ticket.number,
        winning_ticket_id=winning_ticket.id,
        buyer_name=winning_ticket.buyer_name or "",
        buyer_phone=winning_ticket.buyer_phone,
        buyer_email=winning_ticket.buyer_email,
        has_winner=is_paid,
    )
    out = DrawOut.model_validate(draw)
    out.conducted_by_name = current_user.full_name
    out.result = result
    return out


@router.get("/lottery-preview")
def lottery_preview(
    raffle_id: UUID,
    date: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Preview what the lottery draw result would be for a given date, without committing."""
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    if not raffle.lottery_slug:
        raise HTTPException(status_code=400, detail="Esta rifa no tiene una lotería configurada")

    digits = raffle.lottery_digits or 3

    try:
        result_raw = get_result_by_date_and_slug(date, raffle.lottery_slug)
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar el resultado de la lotería")

    if result_raw is None:
        raise HTTPException(
            status_code=404,
            detail=f"No hay resultado de '{raffle.lottery_slug}' para el {date}",
        )

    winning_number_int = extract_winning_number(result_raw, digits)
    ticket = db.query(Ticket).filter(
        Ticket.raffle_id == raffle_id,
        Ticket.number == winning_number_int,
    ).first()

    return {
        "date": date,
        "lottery_slug": raffle.lottery_slug,
        "result_raw": result_raw,
        "digits_used": digits,
        "winning_number": winning_number_int,
        "ticket_exists": ticket is not None,
        "ticket_status": ticket.status if ticket else None,
        "buyer_name": ticket.buyer_name if ticket else None,
        "buyer_phone": ticket.buyer_phone if ticket else None,
        "has_winner": ticket is not None and ticket.status == TicketStatus.paid,
    }


@router.get("")
def get_draw(raffle_id: UUID, db: Session = Depends(get_db)):
    draw = db.query(Draw).filter(Draw.raffle_id == raffle_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    ticket = draw.winning_ticket
    out = DrawOut.model_validate(draw)
    out.conducted_by_name = draw.conducted_by_user.full_name if draw.conducted_by_user else None
    out.result = DrawResult(
        winning_number=ticket.number,
        winning_ticket_id=ticket.id,
        buyer_name=ticket.buyer_name or "",
        buyer_phone=ticket.buyer_phone,
        buyer_email=ticket.buyer_email,
        has_winner=ticket.status == TicketStatus.paid,
    )
    return out


@router.get("/certificate")
def download_certificate(raffle_id: UUID, db: Session = Depends(get_db)):
    draw = db.query(Draw).filter(Draw.raffle_id == raffle_id).first()
    if not draw:
        raise HTTPException(status_code=404, detail="Sorteo no encontrado")
    raffle = draw.raffle
    ticket = draw.winning_ticket
    from app.models.ticket import TicketStatus as _TS
    pdf_bytes = generate_draw_certificate(raffle, draw, ticket, is_paid=ticket.status == _TS.paid)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(pdf_bytes)
    tmp.close()
    return FileResponse(tmp.name, media_type="application/pdf", filename=f"acta-sorteo-{raffle.slug}.pdf")
