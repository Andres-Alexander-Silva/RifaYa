import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, html_content: str) -> bool:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("[EMAIL] SMTP_USER/SMTP_PASSWORD no configurados — email NO enviado a %s: %s", to, subject)
        return False

    from_email = settings.EMAILS_FROM_EMAIL or settings.SMTP_USER
    from_header = f"{settings.EMAILS_FROM_NAME} <{from_email}>" if settings.EMAILS_FROM_NAME else from_email

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_header
    msg["To"] = to
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, to, msg.as_string())
        logger.info("[EMAIL] Enviado a %s: %s", to, subject)
        return True
    except smtplib.SMTPAuthenticationError:
        logger.error("[EMAIL] Autenticación fallida. Verifica SMTP_USER y SMTP_PASSWORD (usa App Password de Google, no tu contraseña normal).")
        return False
    except Exception as exc:
        logger.error("[EMAIL] Error enviando a %s: %s", to, exc)
        return False


def send_payment_confirmation(buyer_email: str, buyer_name: str, ticket_numbers: list[int], raffle_title: str):
    numbers_html = ", ".join(f"<strong>#{n:04d}</strong>" for n in ticket_numbers)
    html = f"""
    <h2>¡Tu pago fue confirmado! 🎉</h2>
    <p>Hola {buyer_name},</p>
    <p>Tu pago para la rifa <strong>{raffle_title}</strong> ha sido confirmado.</p>
    <p>Tus boletos: {numbers_html}</p>
    <p>¡Mucha suerte en el sorteo!</p>
    """
    return send_email(buyer_email, f"Pago confirmado - {raffle_title}", html)


def send_new_payment_alert(admin_email: str, buyer_name: str, ticket_count: int, amount: float, raffle_title: str):
    html = f"""
    <h2>Nuevo pago pendiente 💳</h2>
    <p><strong>{buyer_name}</strong> acaba de enviar un comprobante de pago.</p>
    <p>Rifa: <strong>{raffle_title}</strong></p>
    <p>Boletos: <strong>{ticket_count}</strong></p>
    <p>Monto: <strong>$ {f"{amount:,.0f}".replace(",", ".")}</strong></p>
    <p>Ingresa al panel de administración para confirmar el pago.</p>
    """
    return send_email(admin_email, f"Nuevo pago pendiente — {raffle_title}", html)


def send_winner_notification(buyer_email: str, buyer_name: str, ticket_number: int, raffle_title: str, prize: str):
    html = f"""
    <h2>¡FELICITACIONES, GANASTE! 🏆</h2>
    <p>Hola {buyer_name},</p>
    <p>Tu boleto <strong>#{ticket_number:04d}</strong> ganó la rifa <strong>{raffle_title}</strong>.</p>
    <p>Premio: {prize}</p>
    <p>Pronto nos pondremos en contacto contigo.</p>
    """
    return send_email(buyer_email, f"¡Ganaste la rifa {raffle_title}!", html)


def send_password_reset(to: str, reset_link: str, name: str = ""):
    greeting = f"Hola {name}," if name else "Hola,"
    html = f"""
    <h2>Recuperación de contraseña 🔐</h2>
    <p>{greeting}</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta.</p>
    <p>
      <a href="{reset_link}"
         style="display:inline-block;background:#6366f1;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
        Restablecer contraseña
      </a>
    </p>
    <p>Este enlace expira en <strong>15 minutos</strong>.</p>
    <p>Si no solicitaste este cambio, ignora este correo — tu contraseña no será modificada.</p>
    """
    return send_email(to, "Recuperación de contraseña", html)
