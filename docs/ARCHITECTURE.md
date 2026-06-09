# RifaYa — Arquitectura del Sistema

## Modelo de Negocio

**Un código. Múltiples instancias independientes.**

Eres el único dueño del código. Por cada cliente despliegas una instancia aislada:
- Base de datos PostgreSQL propia (aislamiento total)
- `tenant.config.json` personalizado (colores, logo, nombre)
- Dominio o subdominio propio
- El cliente nunca sabe que es el mismo software

---

## Diagrama de Flujo: Compra de Boleto

```
Comprador                  Sistema                         Admin
    │                          │                              │
    ├─ Visita /rifa/{slug} ───▶│                              │
    │◀── Galería + grilla ─────┤                              │
    │                          │                              │
    ├─ Selecciona boletos ────▶│                              │
    ├─ Ingresa sus datos ─────▶│                              │
    │                          ├─ RESERVE (15 min) ──────────▶ Redis timer
    │◀── Confirmación ─────────┤                              │
    │                          │                              │
    ├─ Paga (WhatsApp/web) ──────────────────────────────────▶│
    │                          │                              ├─ Confirma pago
    │                          │◀── PATCH /payments/confirm ──┤
    │                          ├─ Ticket → PAID               │
    │◀── Email + WhatsApp ─────┤                              │
    │    "¡Pago confirmado!"   │                              │
    │                          │                              │
    ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Día del sorteo ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
    │                          │                              │
    │                          │                ├─ Cierra rifa (CLOSED)
    │                          │                ├─ POST /draw
    │                          │◀───────────────┤
    │                          ├─ secrets.choice()            │
    │                          ├─ Boleto ganador seleccionado │
    │                          ├─ Rifa → DRAWN                │
    │◀── Email + WhatsApp ─────┤                              │
    │    "¡GANASTE!" ────────▶ │                              │
    │                          ├─ Genera PDF Acta de Sorteo   │
```

---

## Esquema de Base de Datos

### Tabla: `users`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| email | VARCHAR(255) UNIQUE | Índice |
| hashed_password | VARCHAR(255) | bcrypt |
| full_name | VARCHAR(255) | |
| phone | VARCHAR(30) | Opcional |
| role | ENUM | admin / seller / buyer |
| is_active | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Tabla: `raffles`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| title | VARCHAR(255) | |
| description | TEXT | |
| prize_description | TEXT | |
| prize_images | JSON | Array de URLs |
| ticket_price | NUMERIC(12,2) | |
| total_tickets | INTEGER | |
| draw_date | TIMESTAMPTZ | |
| status | ENUM | draft/active/closed/drawn |
| numbering_type | ENUM | auto/manual |
| slug | VARCHAR(255) UNIQUE | URL pública |
| created_by_id | UUID FK→users | |
| winner_ticket_id | UUID FK→tickets | Nullable |

### Tabla: `tickets`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| raffle_id | UUID FK→raffles | Índice |
| number | INTEGER | UNIQUE(raffle_id, number) |
| status | ENUM | available/reserved/paid/cancelled |
| buyer_name | VARCHAR(255) | |
| buyer_phone | VARCHAR(30) | |
| buyer_email | VARCHAR(255) | |
| reserved_at | TIMESTAMPTZ | |
| reservation_expires_at | TIMESTAMPTZ | |
| paid_at | TIMESTAMPTZ | |
| payment_id | UUID FK→payments | Nullable |

### Tabla: `payments`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| amount | NUMERIC(12,2) | |
| method | ENUM | wompi/mercadopago/cash/transfer |
| status | ENUM | pending/confirmed/failed/refunded |
| gateway_reference | VARCHAR(255) | Índice |
| gateway_response | JSON | Respuesta completa |
| notes | TEXT | |
| receipt_url | VARCHAR(500) | |
| confirmed_by_id | UUID FK→users | |
| confirmed_at | TIMESTAMPTZ | |

### Tabla: `draws`
| Campo | Tipo | Notas |
|---|---|---|
| id | UUID PK | |
| raffle_id | UUID FK→raffles UNIQUE | |
| winning_ticket_id | UUID FK→tickets | |
| drawn_at | TIMESTAMPTZ | |
| conducted_by_id | UUID FK→users | |
| certificate_url | VARCHAR(500) | |
| algorithm | VARCHAR(50) | "secrets.choice" |

---

## API REST — Resumen de Endpoints

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/auth/register` | Registro de usuario |
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Renovar access token |

### Rifas
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/raffles/public` | No | Listar rifas activas |
| GET | `/api/v1/raffles/public/{slug}` | No | Detalle rifa pública |
| POST | `/api/v1/raffles` | Admin/Seller | Crear rifa |
| GET | `/api/v1/raffles` | Admin/Seller | Listar todas |
| GET | `/api/v1/raffles/{id}` | Admin/Seller | Detalle con stats |
| PATCH | `/api/v1/raffles/{id}` | Admin/Seller | Actualizar / cambiar estado |
| DELETE | `/api/v1/raffles/{id}` | Admin | Eliminar borrador |

### Boletos
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/raffles/{id}/tickets` | No | Grilla pública |
| GET | `/api/v1/raffles/{id}/tickets/search/{num}` | No | Buscar por número |
| POST | `/api/v1/raffles/{id}/tickets/reserve` | No | Reservar 1 boleto |
| POST | `/api/v1/raffles/{id}/tickets/reserve-bulk` | No | Reservar múltiples |
| GET | `/api/v1/raffles/{id}/tickets/admin` | Admin/Seller | Lista admin con todos los datos |

### Pagos
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/v1/payments/manual` | Admin/Seller | Registrar pago manual |
| POST | `/api/v1/payments/{id}/confirm` | Admin/Seller | Confirmar pago |
| GET | `/api/v1/payments` | Admin/Seller | Listar pagos |
| POST | `/api/v1/payments/webhooks/wompi` | No (signed) | Webhook Wompi |
| POST | `/api/v1/payments/webhooks/mercadopago` | No | Webhook MercadoPago |

### Sorteo
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/v1/raffles/{id}/draw` | Admin | Realizar sorteo |
| GET | `/api/v1/raffles/{id}/draw` | No | Ver resultado |
| GET | `/api/v1/raffles/{id}/draw/certificate` | No | Descargar PDF acta |

### Reportes
| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/api/v1/reports/raffles/{id}/buyers/csv` | Admin/Seller | Exportar compradores |
| GET | `/api/v1/reports/raffles/{id}/payments/csv` | Admin/Seller | Exportar pagos |

---

## White Label — tenant.config.json

Cada instancia desplegada tiene su `tenant.config.json`. El frontend lo carga al inicio y aplica:

1. **CSS Variables** en `document.documentElement` → Tailwind las consume via `var(--color-primary)` etc.
2. **`document.title`** → Nombre del sistema
3. **Favicon** → Logo del cliente
4. **Metadatos** → Soporte, WhatsApp, moneda, zona horaria

El cliente solo ve su marca. No hay ninguna referencia a "RifaYa" en la UI desplegada.

---

## Infraestructura por Cliente

```
VPS (DigitalOcean / Contabo / Hostinger)
└── Nginx (proxy reverso + SSL Let's Encrypt)
    ├── rifas.clienteA.com → puerto 3000 (frontend) + 8000 (API)
    └── Docker Compose
        ├── frontend  (Nginx sirviendo React build)
        ├── backend   (FastAPI uvicorn)
        ├── worker    (Celery — tareas reservas + notificaciones)
        ├── openwa    (Servidor WhatsApp Web — autenticado vía QR scan)
        ├── db        (PostgreSQL 16)
        └── redis     (Redis 7)
```

### Flujo de notificación WhatsApp con OpenWA

```
worker (Celery) ──httpx POST /sendText──▶ openwa:8080 ──▶ WhatsApp Web ──▶ Comprador/Ganador
```

- **Sin costo por mensaje** — usa el número WhatsApp del propio cliente
- **Sesión persistente** — QR scan inicial, luego el volumen `openwa_session` la mantiene
- **Formato chatId:** `573XXXXXXXXX@c.us` (sin el `+`, con código de país)
- **Variable de entorno:** `OPENWA_API_KEY` protege el endpoint interno
