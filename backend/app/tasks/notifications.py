from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.payment import Payment
from app.models.draw import Draw
from app.models.ticket import Ticket
from app.services.email import send_payment_confirmation, send_winner_notification, send_new_payment_alert
from app.services.whatsapp import notify_payment_whatsapp, notify_winner_whatsapp


@celery_app.task(name="app.tasks.notifications.notify_payment_confirmed")
def notify_payment_confirmed(payment_id: str):
    db = SessionLocal()
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return
        tickets = payment.tickets
        if not tickets:
            return
        first = tickets[0]
        raffle = first.raffle
        numbers = [t.number for t in tickets]
        if first.buyer_email:
            send_payment_confirmation(first.buyer_email, first.buyer_name or "", numbers, raffle.title)
        if first.buyer_phone:
            notify_payment_whatsapp(first.buyer_phone, first.buyer_name or "", numbers, raffle.title)
    finally:
        db.close()


@celery_app.task(name="app.tasks.notifications.notify_admin_new_payment")
def notify_admin_new_payment(payment_id: str):
    from app.core.config import settings
    if not settings.ADMIN_EMAIL:
        return
    db = SessionLocal()
    try:
        payment = db.query(Payment).filter(Payment.id == payment_id).first()
        if not payment:
            return
        tickets = payment.tickets
        if not tickets:
            return
        first = tickets[0]
        raffle = first.raffle
        send_new_payment_alert(
            settings.ADMIN_EMAIL,
            first.buyer_name or "Comprador",
            len(tickets),
            float(payment.amount),
            raffle.title,
        )
    finally:
        db.close()


@celery_app.task(name="app.tasks.notifications.notify_winner")
def notify_winner(draw_id: str):
    db = SessionLocal()
    try:
        draw = db.query(Draw).filter(Draw.id == draw_id).first()
        if not draw:
            return
        ticket = draw.winning_ticket
        raffle = draw.raffle
        if ticket.buyer_email:
            send_winner_notification(
                ticket.buyer_email,
                ticket.buyer_name or "",
                ticket.number,
                raffle.title,
                raffle.prize_description,
            )
        if ticket.buyer_phone:
            notify_winner_whatsapp(ticket.buyer_phone, ticket.buyer_name or "", ticket.number, raffle.title)
    finally:
        db.close()
