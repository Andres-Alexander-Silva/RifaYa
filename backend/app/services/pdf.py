from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib import colors
import io
from datetime import datetime, timezone


def _ps(name: str = "anon", **kw) -> ParagraphStyle:
    leading = kw.get("leading", kw.get("fontSize", 10) * 1.45)
    return ParagraphStyle(name, leading=leading, **kw)


def generate_draw_certificate(raffle, draw, winning_ticket, is_paid: bool = True) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.5 * cm,
        leftMargin=2.5 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    INDIGO = HexColor("#4f46e5")
    VIOLET = HexColor("#7c3aed")
    SUCCESS = HexColor("#16a34a")
    WARNING = HexColor("#ea580c")
    DARK = HexColor("#1e1b4b")
    MUTED = HexColor("#64748b")
    LIGHT = HexColor("#eeefff")
    BORDER = HexColor("#e2e8f0")

    W = 16 * cm  # usable content width

    elements = []

    # ── 1. Header banner ───────────────────────────────────────────────────────
    hdr = Table(
        [[Paragraph(
            "<b>CERTIFICADO OFICIAL DE SORTEO</b>",
            _ps("hdr", fontSize=22, fontName="Helvetica-Bold",
                textColor=colors.white, alignment=1),
        )]],
        colWidths=[W],
    )
    hdr.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), INDIGO),
        ("TOPPADDING", (0, 0), (-1, -1), 22),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 22),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
    ]))
    elements.append(hdr)
    elements.append(Spacer(1, 0.45 * cm))

    # Raffle title + prize description
    elements.append(Paragraph(
        raffle.title,
        _ps("rt", fontSize=17, fontName="Helvetica-Bold", textColor=DARK, alignment=1, spaceAfter=4),
    ))
    if raffle.prize_description:
        elements.append(Paragraph(
            raffle.prize_description,
            _ps("rd", fontSize=11, fontName="Helvetica", textColor=MUTED, alignment=1),
        ))
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(HRFlowable(width="100%", thickness=2, color=INDIGO,
                               spaceBefore=0.1 * cm, spaceAfter=0.45 * cm))

    # ── 2. Winning number big box ──────────────────────────────────────────────
    num_color = SUCCESS if is_paid else WARNING
    num_bg = HexColor("#f0fdf4") if is_paid else HexColor("#fff7ed")

    num_box = Table(
        [
            [Paragraph(
                "NÚMERO GANADOR",
                _ps("nl", fontSize=10, fontName="Helvetica-Bold",
                    textColor=num_color, alignment=1),
            )],
            [Paragraph(
                f"#{winning_ticket.number:04d}",
                _ps("nv", fontSize=54, fontName="Helvetica-Bold",
                    textColor=num_color, alignment=1, leading=62),
            )],
        ],
        colWidths=[W],
    )
    num_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), num_bg),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("BOX", (0, 0), (-1, -1), 2.5, num_color),
    ]))
    elements.append(num_box)
    elements.append(Spacer(1, 0.45 * cm))

    # ── 3. Section helper ─────────────────────────────────────────────────────
    def section(title: str, color, rows: list) -> Table:
        data = [
            [Paragraph(
                f"<b>{title}</b>",
                _ps(f"sec_{title}", fontSize=11, fontName="Helvetica-Bold",
                    textColor=colors.white),
            ), ""],
        ] + [
            [
                Paragraph(str(label), _ps(f"lbl_{i}", fontSize=10, fontName="Helvetica-Bold", textColor=MUTED)),
                Paragraph(str(value), _ps(f"val_{i}", fontSize=10, fontName="Helvetica", textColor=DARK)),
            ]
            for i, (label, value) in enumerate(rows)
        ]
        t = Table(data, colWidths=[4.5 * cm, 11.5 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), color),
            ("SPAN", (0, 0), (-1, 0)),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
            ("BOX", (0, 0), (-1, -1), 1, BORDER),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, BORDER),
        ]))
        return t

    # Winner / no-winner section
    if is_paid:
        elements.append(section("GANADOR", SUCCESS, [
            ("Nombre", winning_ticket.buyer_name or "—"),
            ("Teléfono", winning_ticket.buyer_phone or "—"),
            ("Email", winning_ticket.buyer_email or "—"),
        ]))
    else:
        elements.append(section("RESULTADO", WARNING, [
            ("Estado del boleto", "No fue vendido — esta rifa no tiene ganador"),
        ]))
    elements.append(Spacer(1, 0.3 * cm))

    # Draw details section
    from app.models.ticket import TicketStatus  # local import avoids circular deps
    paid_count = sum(1 for t in raffle.tickets if t.status == TicketStatus.paid)
    elements.append(section("DETALLES DEL SORTEO", VIOLET, [
        ("Fecha y hora",     draw.drawn_at.strftime("%d/%m/%Y a las %H:%M UTC")),
        ("Total boletos",    str(raffle.total_tickets)),
        ("Boletos vendidos", str(paid_count)),
        ("Algoritmo",        "Aleatorio criptográfico — Python secrets.choice"),
        ("ID certificado",   str(draw.id)[:8].upper()),
    ]))
    elements.append(Spacer(1, 0.85 * cm))

    # ── 4. Signature lines ────────────────────────────────────────────────────
    sig = Table(
        [
            ["________________________", "   ", "________________________"],
            ["Firma del organizador",   "   ", "Testigo / Sello"],
        ],
        colWidths=[6 * cm, 4 * cm, 6 * cm],
    )
    sig.setStyle(TableStyle([
        ("ALIGN",     (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE",  (0, 0), (-1, -1), 9),
        ("FONTNAME",  (0, 0), (-1, -1), "Helvetica"),
        ("TEXTCOLOR", (0, 0), (-1, -1), MUTED),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(sig)
    elements.append(Spacer(1, 0.45 * cm))

    # ── 5. Footer ─────────────────────────────────────────────────────────────
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=0.3 * cm))
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y a las %H:%M UTC")
    elements.append(Paragraph(
        f"Generado el {now_str}  ·  "
        "Este certificado acredita que el sorteo se realizó de forma transparente y aleatoria.  ·  "
        f"Código de verificación: {str(draw.id)[:8].upper()}",
        _ps("foot", fontSize=7.5, fontName="Helvetica", textColor=MUTED, alignment=1),
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
