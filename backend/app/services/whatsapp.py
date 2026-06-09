import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


def _phone_to_chat_id(phone: str) -> str:
    clean = phone.strip().lstrip("+").replace(" ", "").replace("-", "")
    return f"{clean}@c.us"


def send_whatsapp(to: str, message: str) -> bool:
    if not settings.OPENWA_API_URL:
        logger.warning("[WHATSAPP] OPENWA_API_URL no configurada — mensaje NO enviado a %s", to)
        return False
    if not settings.OPENWA_SESSION_ID:
        logger.warning("[WHATSAPP] OPENWA_SESSION_ID no configurada — mensaje NO enviado a %s", to)
        return False

    chat_id = _phone_to_chat_id(to)
    headers = {
        "X-API-Key": settings.OPENWA_API_KEY,
        "Content-Type": "application/json",
    }
    url = f"{settings.OPENWA_API_URL.rstrip('/')}/sessions/{settings.OPENWA_SESSION_ID}/messages/send-text"

    try:
        response = httpx.post(
            url,
            json={"chatId": chat_id, "text": message},
            headers=headers,
            timeout=15.0,
        )
        response.raise_for_status()
        return True
    except httpx.HTTPStatusError as exc:
        logger.error("[WHATSAPP] HTTP %s al enviar a %s: %s", exc.response.status_code, to, exc.response.text)
        return False
    except httpx.HTTPError as exc:
        logger.error("[WHATSAPP] Error de conexión enviando a %s: %s", to, exc)
        return False


def notify_winner_whatsapp(phone: str, name: str, ticket_number: int, raffle_title: str):
    msg = (
        f"🏆 ¡FELICITACIONES {name.upper()}! "
        f"Tu boleto #{ticket_number:04d} GANÓ la rifa '{raffle_title}'. "
        "Pronto nos comunicaremos contigo para entregarte tu premio."
    )
    return send_whatsapp(phone, msg)


def notify_payment_whatsapp(phone: str, name: str, ticket_numbers: list[int], raffle_title: str):
    numbers = ", ".join(f"#{n:04d}" for n in ticket_numbers)
    msg = (
        f"✅ ¡Hola {name}! Tu pago para la rifa '{raffle_title}' fue confirmado. "
        f"Tus boletos: {numbers}. ¡Buena suerte!"
    )
    return send_whatsapp(phone, msg)
