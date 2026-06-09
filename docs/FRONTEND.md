# RifaYa — Documentación Frontend

## Stack

| Componente | Tecnología |
|-----------|-----------|
| Framework | React 18.3 + TypeScript 5.6 |
| Build | Vite 5.4 |
| Estilos | TailwindCSS 3.4 + Shadcn/UI (Radix) |
| Routing | React Router 6.26 |
| HTTP | Axios 1.7 + TanStack Query 5 |
| Estado | Zustand 5 |
| Formularios | React Hook Form 7 + Zod 3 |
| Gráficas | Recharts 2.12 |
| Animaciones | Framer Motion 11 |
| Iconos | Lucide React |
| Fechas | date-fns 4 |

---

## Estructura de directorios

```
frontend/
├── src/
│   ├── main.tsx              # Punto de entrada React
│   ├── App.tsx               # Router principal (rutas públicas, auth, admin)
│   ├── index.css             # Estilos globales + variables CSS
│   ├── vite-env.d.ts         # Tipos para import.meta.env
│   ├── pages/
│   │   ├── public/
│   │   │   ├── Home.tsx          # Landing con lista de rifas activas
│   │   │   ├── RaffleLanding.tsx # Detalle público de una rifa
│   │   │   └── TicketSearch.tsx  # Buscar boleto por número
│   │   ├── auth/
│   │   │   ├── Login.tsx
│   │   │   ├── ForgotPassword.tsx
│   │   │   └── ResetPassword.tsx
│   │   └── admin/
│   │       ├── Dashboard.tsx     # Panel de control con estadísticas
│   │       ├── Raffles.tsx       # Lista y gestión de rifas
│   │       ├── RaffleDetail.tsx  # Editar rifa, ver boletos
│   │       ├── Payments.tsx      # Aprobar pagos pendientes
│   │       └── DrawPage.tsx      # Realizar sorteo con animación
│   ├── components/
│   │   ├── layout/
│   │   │   └── AdminLayout.tsx   # Header + sidebar admin
│   │   ├── raffle/
│   │   │   └── RaffleForm.tsx    # Formulario crear/editar rifa
│   │   ├── payment/              # Componentes del flujo de pago
│   │   ├── draw/                 # Animación y resultado del sorteo
│   │   ├── common/               # Componentes genéricos reutilizables
│   │   └── ui/                   # Primitivos Shadcn/UI
│   ├── store/
│   │   ├── authStore.ts          # Estado de autenticación (Zustand)
│   │   └── tenantStore.ts        # Configuración del tenant (Zustand)
│   ├── hooks/
│   │   └── useRaffleSocket.ts    # Conexión WebSocket por rifa
│   ├── lib/
│   │   ├── api.ts                # Instancia Axios + interceptores JWT
│   │   └── utils.ts              # Formateadores de moneda, fechas, etc.
│   ├── types/
│   │   └── index.ts              # Interfaces TypeScript del dominio
│   └── config/
│       └── tenant.ts             # Loader del tenant config
├── public/
│   ├── logo_rifaya.png
│   └── tenant.config.json        # Configuración del tenant (copiada del root)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── Dockerfile
└── nginx.conf
```

---

## Rutas y páginas

### Públicas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `Home.tsx` | Landing page con todas las rifas activas |
| `/rifa/:slug` | `RaffleLanding.tsx` | Detalle de una rifa, visualización de boletos, flujo de compra |
| `/rifa/:slug/buscar` | `TicketSearch.tsx` | Buscar el estado de un boleto por número |

### Autenticación

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/login` | `Login.tsx` | Formulario de acceso con email + contraseña |
| `/forgot-password` | `ForgotPassword.tsx` | Solicitar enlace de recuperación |
| `/reset-password` | `ResetPassword.tsx` | Ingresar token + nueva contraseña |

### Admin (requieren rol `admin` o `seller`)

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/admin` | `Dashboard.tsx` | Resumen general con gráficas y pagos pendientes |
| `/admin/rifas` | `Raffles.tsx` | Lista de rifas con acciones CRUD |
| `/admin/rifas/:id` | `RaffleDetail.tsx` | Editar rifa, estadísticas, gestión de boletos |
| `/admin/pagos` | `Payments.tsx` | Pagos pendientes y aprobados |
| `/admin/rifas/:id/sorteo` | `DrawPage.tsx` | Realizar sorteo con animación |

Las páginas admin se cargan con **code splitting** (`React.lazy`) para no inflar el bundle inicial.

---

## Estado global (Zustand)

### `authStore.ts`

```typescript
{
  accessToken: string | null
  refreshToken: string | null
  user: User | null

  setTokens(access, refresh): void   // Después del login
  setUser(user): void
  logout(): void                      // Limpia tokens y redirige
}
```

El access token se inyecta automáticamente en cada petición HTTP via interceptor de Axios.
El refresh token se usa automáticamente cuando el backend devuelve 401.

### `tenantStore.ts`

```typescript
{
  config: TenantConfig | null
  setConfig(config): void
}
```

Se carga una vez al iniciar la app llamando a `GET /api/v1/config`.

---

## API y autenticación HTTP

**Archivo:** `src/lib/api.ts`

```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

export const api = axios.create({ baseURL: API_BASE });
```

- En **desarrollo** (`VITE_API_BASE_URL` no definida): usa `/api/v1`, el proxy de Vite lo redirige a `http://localhost:8000`.
- En **producción Render** (`VITE_API_BASE_URL` definida en build): usa la URL absoluta del backend, ej. `https://rifaya-api.onrender.com/api/v1`.

**Interceptor de request:** agrega `Authorization: Bearer <token>` si hay token en el store.

**Interceptor de response:** si recibe 401, intenta renovar el access token con el refresh token automáticamente, reintenta la petición original, y si falla hace logout.

---

## WebSocket en tiempo real

**Archivo:** `src/hooks/useRaffleSocket.ts`

Conexión a `/ws/raffle/{raffle_id}` para recibir actualizaciones de boletos sin recargar la página.

```typescript
const { tickets } = useRaffleSocket(raffleId);
```

El hook gestiona la reconexión automática y actualiza el estado local cuando llega un mensaje `tickets_updated`.

---

## Tipos TypeScript

**Archivo:** `src/types/index.ts`

Interfaces principales del dominio:

```typescript
User         // id, email, full_name, phone, role, is_active, created_at
Raffle       // id, title, slug, prize_description, prize_images[], ticket_price,
             // total_tickets, draw_date, status, is_visible, lottery_slug, stats
RaffleStats  // total, available, reserved, paid, revenue, target, progress_pct
Ticket       // id, raffle_id, number, status, buyer_*, reserved_at, paid_at
Payment      // id, amount, method, status, receipt_url, notes, confirmed_by_*
Draw         // id, raffle_id, winning_ticket_id, drawn_at, certificate_url
DrawResult   // winning_number, buyer_name, buyer_phone, has_winner
TenantConfig // Branding + features (cargado desde /api/v1/config)
```

---

## Tenant config (`tenant.config.json`)

El archivo `tenant.config.json` de la raíz del proyecto se monta en el backend y se sirve via `/api/v1/config`. El frontend lo lee al iniciar y aplica los colores y textos.

```json
{
  "name": "RifaYa",
  "tagline": "¡Tu suerte empieza aquí!",
  "slug": "rifaya",
  "logoUrl": "/logo.png",
  "faviconUrl": "/favicon.ico",

  "primaryColor": "#6366f1",
  "secondaryColor": "#8b5cf6",
  "backgroundColor": "#ffffff",
  "foregroundColor": "#0f172a",

  "supportPhone": "+57 300 000 0000",
  "supportEmail": "soporte@tudominio.com",
  "whatsappUrl": "https://wa.me/573000000000",
  "socialLinks": { "instagram": "", "facebook": "", "tiktok": "" },

  "currency": "COP",
  "currencySymbol": "$",
  "locale": "es-CO",
  "timezone": "America/Bogota",
  "reservationMinutes": 15,

  "paymentMethods": ["cash", "transfer"],
  "payment": {
    "nequiPhone": "",
    "bankName": "",
    "bankAccount": "",
    "bankAccountHolder": "",
    "bankQRUrl": "",
    "cashInstructions": "...",
    "proofInstructions": "..."
  },

  "features": {
    "publicLanding": true,
    "whatsappNotifications": true,
    "emailNotifications": true,
    "drawAnimation": true
  }
}
```

**Antes de ir a producción, llenar:**
- `supportPhone`, `supportEmail`, `whatsappUrl`
- `payment.bankName`, `payment.bankAccount`, `payment.bankAccountHolder`
- `payment.nequiPhone` (si ofreces pago por Nequi)
- `socialLinks.instagram` / `facebook` / `tiktok` (opcional)

---

## Flujo de compra (desde el frontend)

1. **`/rifa/:slug`** — comprador ve los boletos disponibles en el grid.
2. Selecciona boleto(s) → `POST /tickets/reserve` — reserva por 15 minutos (cuenta regresiva visible).
3. Ingresa nombre, teléfono y correo.
4. Elige método de pago (`cash` o `transfer`).
   - **Transferencia:** ve los datos bancarios del `tenant.config.json` → hace la transferencia → sube el comprobante → `POST /payments/public-submit`.
   - **Efectivo:** ve instrucciones de contacto por WhatsApp.
5. Admin recibe alerta, va a `/admin/pagos`, verifica el comprobante, confirma con `POST /payments/{id}/confirm`.
6. El comprador recibe email + WhatsApp con confirmación.

---

## Variables de entorno (build time)

| Variable | Cuándo usarla | Valor en Render |
|----------|--------------|-----------------|
| `VITE_API_BASE_URL` | Render Static Site (dominios distintos) | `https://rifaya-api.onrender.com/api/v1` |

En Docker local (nginx proxy) no se necesita — la URL relativa `/api/v1` funciona.

---

## Comandos de desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (proxy a localhost:8000)
npm run dev

# Build de producción
npm run build

# Verificar tipos TypeScript
npx tsc --noEmit

# Preview del build
npm run preview
```

### Proxy de desarrollo (`vite.config.ts`)

```typescript
server: {
  port: 3000,
  proxy: {
    "/api": "http://localhost:8000",
    "/uploads": "http://localhost:8000",
  }
}
```

Permite hacer peticiones a `/api/v1/...` desde el frontend sin problemas de CORS en desarrollo.

---

## Build con Docker

```dockerfile
# Etapa build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa producción (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

El `nginx.conf` incluye:
- Manejo de SPA (redirige 404 a `index.html`)
- Proxy de `/api/` al backend en el contenedor `backend:8000`
- Proxy de `/uploads/` al backend (para imágenes locales en Docker)
- Cache headers para assets estáticos (`*.js`, `*.css`, imágenes)
