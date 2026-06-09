from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.ticket import Ticket, TicketStatus
from datetime import datetime, timezone


@celery_app.task(name="app.tasks.reservations.expire_reservation")
def expire_reservation(ticket_id: str):
    db = SessionLocal()
    try:
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket or ticket.status != TicketStatus.reserved:
            return
        if ticket.reservation_expires_at and ticket.reservation_expires_at <= datetime.now(timezone.utc):
            ticket.status = TicketStatus.available
            ticket.buyer_name = None
            ticket.buyer_phone = None
            ticket.buyer_email = None
            ticket.reserved_at = None
            ticket.reservation_expires_at = None
            ticket.payment_id = None
            db.commit()
    finally:
        db.close()
