# RifaYa — Documentación Backend

## Stack

| Componente | Tecnología |
|-----------|-----------|
| Framework | FastAPI 0.115 |
| Base de datos | PostgreSQL (SQLAlchemy 2.0 + Alembic) |
| Tareas asíncronas | Celery 5.4 + Redis |
| Servidor ASGI | Uvicorn |
| Autenticación | JWT (python-jose + bcrypt) |
| Almacenamiento | Cloudinary (prod) / local (dev) |
| PDF / QR | ReportLab + qrcode |
| Rate limiting | Slowapi |
| Monitoreo | Sentry SDK |

---

## Estructura de directorios

```
backend/
├── app/
│   ├── main.py               # Punto de entrada FastAPI (CORS, Sentry, rutas)
│   ├── database.py           # Motor SQLAlchemy + SessionLocal
│   ├── api/
│   │   ├── deps.py           # Inyección de dependencias (auth, roles)
│   │   └── v1/
│   │       ├── router.py     # Agrupación de todos los routers
│   │       ├── auth.py       # Registro, login, refresh, reset de contraseña
│   │       ├── config.py     # Endpoint de configuración del tenant
│   │       ├── draws.py      # Lógica del sorteo
│   │       ├── lotteries.py  # Consulta de resultados de loterías externas
│   │       ├── payments.py   # Pagos, confirmación, webhooks
│   │       ├── raffles.py    # CRUD de rifas
│   │       ├── reports.py    # Exportación Excel
│   │       ├── tickets.py    # Reservas y gestión de boletos
│   │       ├── uploads.py    # Carga de imágenes (Cloudinary o local)
│   │       ├── users.py      # Perfil de usuario
│   │       └── ws.py         # WebSocket en tiempo real
│   ├── core/
│   │   ├── celery_app.py     # Configuración Celery (broker, colas)
│   │   ├── config.py         # Settings via pydantic-settings (.env)
│   │   ├── limiter.py        # Rate limiter global
│   │   └── security.py       # JWT, hash de contraseñas
│   ├── models/               # Modelos ORM SQLAlchemy
│   │   ├── draw.py
│   │   ├── payment.py
│   │   ├── raffle.py
│   │   ├── ticket.py
│   │   └── user.py
│   ├── schemas/              # Modelos Pydantic (request/response)
│   │   ├── draw.py
│   │   ├── payment.py
│   │   ├── raffle.py
│   │   ├── ticket.py
│   │   └── user.py
│   ├── services/             # Lógica de negocio externa
│   │   ├── email.py          # Envío de correos (Gmail SMTP)
│   │   ├── lottery.py        # Cliente API de loterías
│   │   ├── pdf.py            # Generación de certificados PDF
│   │   └── whatsapp.py       # Notificaciones WhatsApp (OpenWA)
│   ├── tasks/                # Tareas Celery
│   │   ├── notifications.py  # Notificaciones de pago y ganador
│   │   └── reservations.py   # Expiración de reservas
│   └── scripts/
│       └── create_admin.py   # Creación del usuario administrador
├── alembic/                  # Migraciones de base de datos
│   └── versions/             # 3 migraciones
├── uploads/                  # Directorio de archivos subidos (dev)
│   └── .gitkeep
├── requirements.txt
├── Dockerfile
├── alembic.ini
└── reset_db.py               # ⚠️ Solo desarrollo — nunca borrar
```

---

## Modelos de base de datos

### User

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | Identificador único |
| `email` | String único | Correo electrónico (login) |
| `hashed_password` | String | Contraseña hasheada con bcrypt |
| `full_name` | String | Nombre completo |
| `phone` | String nullable | Teléfono de contacto |
| `role` | Enum | `admin`, `seller`, `buyer` |
| `is_active` | Boolean | Cuenta habilitada |
| `created_at` / `updated_at` | DateTime UTC | Timestamps |

### Raffle

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `title` | String | Título de la rifa |
| `slug` | String único | URL amigable, generado del título |
| `description` | Text nullable | Descripción larga |
| `prize_description` | Text | Descripción del premio |
| `prize_images` | JSON `[]` | Lista de URLs de imágenes del premio |
| `ticket_price` | Decimal(12,2) | Precio por boleto |
| `total_tickets` | Integer | Cantidad total de boletos |
| `draw_date` | DateTime UTC | Fecha y hora del sorteo |
| `status` | Enum | `draft`, `active`, `closed`, `drawn` |
| `is_visible` | Boolean | Visible en la landing pública |
| `numbering_type` | Enum | `auto` (0…N-1) o `manual` |
| `lottery_slug` | String nullable | Lotería externa asociada |
| `lottery_digits` | Integer nullable | Dígitos usados del número de lotería (2 o 3) |
| `created_by_id` | UUID FK → User | Administrador/vendedor creador |
| `winner_ticket_id` | UUID FK nullable | Boleto ganador tras el sorteo |

### Ticket

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `raffle_id` | UUID FK | Rifa a la que pertenece |
| `number` | Integer | Número del boleto |
| `status` | Enum | `available`, `reserved`, `paid`, `cancelled` |
| `buyer_name` / `buyer_phone` / `buyer_email` | String nullable | Datos del comprador |
| `reserved_at` | DateTime nullable | Cuándo se reservó |
| `reservation_expires_at` | DateTime nullable | Vence la reserva (15 min por defecto) |
| `paid_at` | DateTime nullable | Cuándo se confirmó el pago |
| `payment_id` | UUID FK nullable | Pago asociado |

**Restricción única:** `(raffle_id, number)` — no puede haber dos boletos con el mismo número en la misma rifa.

### Payment

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `amount` | Decimal(12,2) | Monto del pago |
| `method` | Enum | `cash`, `transfer` |
| `status` | Enum | `pending`, `confirmed`, `failed`, `refunded` |
| `receipt_url` | String nullable | URL del comprobante subido |
| `notes` | Text nullable | Notas del administrador |
| `confirmed_by_id` | UUID FK nullable | Admin que confirmó |
| `confirmed_at` | DateTime nullable | Cuándo se confirmó |

### Draw

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID PK | |
| `raffle_id` | UUID FK único | Rifa sorteada |
| `winning_ticket_id` | UUID FK | Boleto ganador |
| `drawn_at` | DateTime UTC | Momento del sorteo |
| `conducted_by_id` | UUID FK | Admin que realizó el sorteo |
| `certificate_url` | String nullable | URL del certificado PDF |
| `algorithm` | String | `secure_random` (por defecto) |

---

## Endpoints de la API

Base URL: `/api/v1`

### Autenticación

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/auth/register` | Registro de nuevo usuario | Público |
| POST | `/auth/login` | Login — devuelve `access_token` y `refresh_token` | Público |
| POST | `/auth/refresh` | Renovar access token con refresh token | Público |
| POST | `/auth/forgot-password` | Solicitar link de reset de contraseña | Público |
| POST | `/auth/reset-password` | Completar reset con token + nueva contraseña | Público |

### Configuración del tenant

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/config` | Devuelve `tenant.config.json` completo | Público |

### Rifas

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/raffles/public` | Listar rifas activas y visibles | Público |
| GET | `/raffles/public/{slug}` | Detalle de una rifa pública | Público |
| POST | `/raffles` | Crear nueva rifa | Seller/Admin |
| GET | `/raffles` | Listar todas las rifas (admin view) | Seller/Admin |
| GET | `/raffles/{id}` | Detalle de rifa | Seller/Admin |
| PATCH | `/raffles/{id}` | Actualizar rifa | Seller/Admin |
| DELETE | `/raffles/{id}` | Eliminar rifa (solo `draft`) | Admin |
| PATCH | `/raffles/{id}/visibility` | Mostrar/ocultar en landing | Admin |

### Boletos

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/raffles/{id}/tickets` | Listar boletos con filtros | Seller/Admin |
| POST | `/raffles/{id}/tickets/reserve` | Reservar un boleto | Público |
| POST | `/raffles/{id}/tickets/reserve-bulk` | Reservar varios boletos | Público |
| GET | `/raffles/{id}/tickets/search/{number}` | Buscar boleto por número | Público |

### Sorteo

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/raffles/{id}/draw` | Realizar el sorteo | Admin |
| GET | `/raffles/{id}/draw` | Obtener resultado del sorteo | Público |
| GET | `/raffles/{id}/draw/lottery-preview` | Vista previa con lotería externa | Admin |
| GET | `/raffles/{id}/draw/certificate` | Descargar certificado PDF | Admin |

### Pagos

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/payments/public-submit` | Comprador sube comprobante de pago | Público |
| POST | `/payments/manual` | Admin registra pago manual | Admin |
| POST | `/payments/{id}/confirm` | Admin confirma pago pendiente | Admin |
| GET | `/payments` | Listar pagos (con filtros) | Seller/Admin |
| GET | `/payments/{id}` | Detalle de un pago | Seller/Admin |

### Reportes

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/reports/raffles/{id}/buyers/csv` | Exportar compradores a Excel | Admin |
| GET | `/reports/raffles/{id}/payments/csv` | Exportar pagos a Excel | Admin |

### Usuarios

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/users/me` | Perfil del usuario actual | Autenticado |
| PATCH | `/users/me` | Actualizar perfil propio | Autenticado |
| GET | `/users` | Listar usuarios | Admin |
| PATCH | `/users/{id}` | Actualizar usuario | Admin |

### Uploads

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/uploads/image` | Subir imagen (hasta 10 MB) | Autenticado |

### WebSocket

| Protocolo | Ruta | Descripción |
|-----------|------|-------------|
| WS | `/ws/raffle/{raffle_id}` | Actualizaciones en tiempo real de boletos |

Mensajes del servidor:
```json
{ "type": "tickets_updated", "tickets": [{ "id": "...", "number": 42, "status": "paid" }] }
```

### Utilidades

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Estado del sistema (DB + Redis) |
| GET | `/lotteries` | Listar loterías disponibles |
| GET | `/lotteries/result` | Resultado de la lotería del día |

---

## Autenticación y autorización

### Tokens JWT

- **Access token:** expira en 24 horas
- **Refresh token:** expira en 30 días
- **Algoritmo:** HS256
- **Header:** `Authorization: Bearer <token>`

### Roles

| Rol | Permisos |
|-----|----------|
| `admin` | Acceso total |
| `seller` | Crear/gestionar rifas, ver pagos |
| `buyer` | Solo endpoints públicos |

### Dependencias reutilizables (`api/deps.py`)

```python
get_current_user()         # Valida JWT → devuelve User
require_admin()            # Solo admin
require_seller_or_admin()  # Seller o admin
```

---

## Ciclo de vida de un boleto

```
available → reserved (reserva, 15 min) → paid (pago confirmado)
                ↓ (expira sin pago)
            available
```

La tarea Celery `expire_reservation` limpia reservas vencidas automáticamente.

---

## Tareas en segundo plano (Celery)

| Tarea | Cola | Disparador | Acción |
|-------|------|------------|--------|
| `notify_payment_confirmed` | notifications | Pago confirmado | Email + WhatsApp al comprador |
| `notify_admin_new_payment` | notifications | Nuevo pago pendiente | Alerta al admin |
| `notify_winner` | notifications | Sorteo realizado | Notifica al ganador |
| `expire_reservation` | reservations | 15 min tras reserva | Libera boletos no pagados |

---

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SECRET_KEY` | Sí | Clave para firmar JWT (48 bytes base64) |
| `DATABASE_URL` | Sí | `postgresql://user:pass@host/db` |
| `REDIS_URL` | Sí | `redis://host:6379/0` |
| `FRONTEND_URL` | Sí | URL del frontend (para CORS y links en emails) |
| `BACKEND_CORS_ORIGINS` | Prod | Lista JSON de orígenes permitidos |
| `SMTP_HOST` | Emails | `smtp.gmail.com` |
| `SMTP_PORT` | Emails | `587` |
| `SMTP_USER` | Emails | Cuenta de Gmail |
| `SMTP_PASSWORD` | Emails | App Password de 16 caracteres |
| `EMAILS_FROM_EMAIL` | Emails | Remitente visible (igual a SMTP_USER) |
| `EMAILS_FROM_NAME` | Emails | Nombre del remitente (`RifaYa`) |
| `ADMIN_EMAIL` | Emails | Recibe alertas de pagos pendientes |
| `OPENWA_API_URL` | WhatsApp | URL del servicio OpenWA |
| `OPENWA_API_KEY` | WhatsApp | Clave de la API de OpenWA |
| `OPENWA_SESSION_ID` | WhatsApp | ID de la sesión WhatsApp |
| `CLOUDINARY_CLOUD_NAME` | Imágenes prod | Nombre de la cuenta Cloudinary |
| `CLOUDINARY_API_KEY` | Imágenes prod | Clave de API Cloudinary |
| `CLOUDINARY_API_SECRET` | Imágenes prod | Secreto de API Cloudinary |
| `SENTRY_DSN` | Opcional | DSN para reporte de errores |
| `TENANT_CONFIG_PATH` | Opcional | Ruta a `tenant.config.json` (default: `/app/tenant.config.json`) |
| `RESERVATION_MINUTES` | Opcional | Minutos de reserva (default: 15) |

---

## Migraciones de base de datos

```bash
# Aplicar todas las migraciones
alembic upgrade head

# Crear nueva migración tras cambiar un modelo
alembic revision --autogenerate -m "descripcion"

# Ver migraciones aplicadas
alembic history
```

Las migraciones existentes:
1. `e9cd98a2eb43` — Esquema inicial completo (users, raffles, tickets, payments, draws)
2. `b7f3e4a2c891` — Agrega `is_visible` a raffles
3. `d8e3f5c9a012` — Agrega `lottery_slug` y `lottery_digits` a raffles

---

## Almacenamiento de imágenes

El endpoint `POST /uploads/image` detecta automáticamente el modo:

- **Cloudinary** (producción): Cuando `CLOUDINARY_CLOUD_NAME` y `CLOUDINARY_API_KEY` están definidos. Devuelve una URL absoluta CDN (`https://res.cloudinary.com/...`).
- **Local** (desarrollo): Guarda en `/backend/uploads/` y devuelve una URL relativa (`/uploads/nombre.jpg`). Los archivos se sirven como estáticos.

---

## Comandos de desarrollo

```bash
# Instalar dependencias
pip install -r requirements.txt

# Levantar solo DB y Redis (Docker)
docker compose -f docker-compose.dev.yml up -d

# Correr el servidor de desarrollo
uvicorn app.main:app --reload --port 8000

# Correr el worker Celery (en otra terminal)
celery -A app.core.celery_app worker --queues reservations,notifications -l info

# Crear el usuario administrador inicial
python app/scripts/create_admin.py

# Aplicar migraciones
alembic upgrade head
```
