from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import UUID
import re
from decimal import Decimal
from app.database import get_db
from app.api.deps import get_current_user, require_admin, require_seller_or_admin
from app.models.raffle import Raffle, RaffleStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User
from app.schemas.raffle import RaffleCreate, RaffleUpdate, RaffleOut, RafflePublic, RaffleStats

router = APIRouter(prefix="/raffles", tags=["Rifas"])


def build_slug(title: str, db: Session) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    slug = base
    counter = 1
    while db.query(Raffle).filter(Raffle.slug == slug).first():
        slug = f"{base}-{counter}"
        counter += 1
    return slug


def compute_stats(raffle: Raffle, db: Session) -> RaffleStats:
    counts = (
        db.query(Ticket.status, func.count(Ticket.id))
        .filter(Ticket.raffle_id == raffle.id)
        .group_by(Ticket.status)
        .all()
    )
    status_map = {s: c for s, c in counts}
    paid = status_map.get(TicketStatus.paid, 0)
    reserved = status_map.get(TicketStatus.reserved, 0)
    available = status_map.get(TicketStatus.available, 0)
    revenue = Decimal(paid) * raffle.ticket_price
    target = Decimal(raffle.total_tickets) * raffle.ticket_price
    return RaffleStats(
        total=raffle.total_tickets,
        available=available,
        reserved=reserved,
        paid=paid,
        revenue=revenue,
        target=target,
        progress_pct=float(revenue / target * 100) if target else 0,
    )


def batch_compute_stats(raffles: list, db: Session) -> dict:
    """Single-query stats for a list of raffles — avoids N+1."""
    if not raffles:
        return {}
    raffle_ids = [r.id for r in raffles]
    rows = (
        db.query(Ticket.raffle_id, Ticket.status, func.count(Ticket.id))
        .filter(Ticket.raffle_id.in_(raffle_ids))
        .group_by(Ticket.raffle_id, Ticket.status)
        .all()
    )
    raw: dict = {}
    for raffle_id, status, count in rows:
        raw.setdefault(raffle_id, {})[status] = count

    result = {}
    for r in raffles:
        sc = raw.get(r.id, {})
        paid = sc.get(TicketStatus.paid, 0)
        reserved = sc.get(TicketStatus.reserved, 0)
        available = sc.get(TicketStatus.available, 0)
        revenue = Decimal(paid) * r.ticket_price
        target = Decimal(r.total_tickets) * r.ticket_price
        result[r.id] = RaffleStats(
            total=r.total_tickets,
            available=available,
            reserved=reserved,
            paid=paid,
            revenue=revenue,
            target=target,
            progress_pct=float(revenue / target * 100) if target else 0,
        )
    return result


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("/public", response_model=list[RafflePublic])
def list_public_raffles(db: Session = Depends(get_db)):
    raffles = db.query(Raffle).filter(Raffle.is_visible == True).all()
    stats_map = batch_compute_stats(raffles, db)
    result = []
    for r in raffles:
        public = RafflePublic.model_validate(r)
        public.stats = stats_map.get(r.id)
        result.append(public)
    return result


@router.get("/public/{slug}", response_model=RafflePublic)
def get_public_raffle(slug: str, db: Session = Depends(get_db)):
    raffle = db.query(Raffle).filter(Raffle.slug == slug).first()
    if not raffle or not raffle.is_visible:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    public = RafflePublic.model_validate(raffle)
    public.stats = compute_stats(raffle, db)
    return public


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.post("", response_model=RaffleOut, status_code=201)
def create_raffle(
    payload: RaffleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller_or_admin),
):
    slug = build_slug(payload.title, db)
    raffle = Raffle(**payload.model_dump(), slug=slug, created_by_id=current_user.id)
    db.add(raffle)
    db.flush()

    # Auto-generate tickets
    tickets = [Ticket(raffle_id=raffle.id, number=i + 1) for i in range(payload.total_tickets)]
    db.bulk_save_objects(tickets)
    db.commit()
    db.refresh(raffle)
    return raffle


@router.get("", response_model=list[RaffleOut])
def list_raffles(
    status: RaffleStatus | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_seller_or_admin),
):
    q = db.query(Raffle)
    if status:
        q = q.filter(Raffle.status == status)
    raffles = q.offset(skip).limit(limit).all()
    stats_map = batch_compute_stats(raffles, db)
    result = []
    for r in raffles:
        out = RaffleOut.model_validate(r)
        out.stats = stats_map.get(r.id)
        result.append(out)
    return result


@router.get("/{raffle_id}", response_model=RaffleOut)
def get_raffle(raffle_id: UUID, db: Session = Depends(get_db), _=Depends(require_seller_or_admin)):
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    out = RaffleOut.model_validate(raffle)
    out.stats = compute_stats(raffle, db)
    return out


@router.patch("/{raffle_id}", response_model=RaffleOut)
def update_raffle(
    raffle_id: UUID,
    payload: RaffleUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_seller_or_admin),
):
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(raffle, field, value)
    db.commit()
    db.refresh(raffle)
    return raffle


@router.patch("/{raffle_id}/visibility", response_model=RaffleOut)
def toggle_visibility(raffle_id: UUID, db: Session = Depends(get_db), _=Depends(require_seller_or_admin)):
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    raffle.is_visible = not raffle.is_visible
    db.commit()
    db.refresh(raffle)
    out = RaffleOut.model_validate(raffle)
    out.stats = compute_stats(raffle, db)
    return out


@router.delete("/{raffle_id}", status_code=204)
def delete_raffle(raffle_id: UUID, db: Session = Depends(get_db), _=Depends(require_admin)):
    raffle = db.query(Raffle).filter(Raffle.id == raffle_id).first()
    if not raffle:
        raise HTTPException(status_code=404, detail="Rifa no encontrada")
    if raffle.status != RaffleStatus.draft:
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar rifas en borrador")
    db.delete(raffle)
    db.commit()
