# RifaYa — Plan de Desarrollo por Fases

---

## FASE 1 — MVP (Semanas 1–4)
**Meta:** Un admin puede crear una rifa, un comprador puede reservar y el admin confirma manualmente.

### Semana 1 — Backend base
- [ ] Instalar dependencias y configurar entorno local
- [ ] Configurar PostgreSQL + Redis local (docker-compose.dev.yml)
- [ ] Ejecutar `alembic revision --autogenerate` y `alembic upgrade head`
- [ ] Probar endpoints de autenticación (registro + login)
- [ ] Probar CRUD de rifas con Postman/Swagger
- [ ] Probar reserva de boletos con expiración automática

### Semana 2 — Flujo de pagos manuales
- [ ] Registrar pago manual (efectivo/transferencia)
- [ ] Confirmar pago desde panel admin
- [ ] Verificar que boletos cambian a PAID al confirmar
- [ ] Exportación CSV de compradores funcional

### Semana 3 — Frontend base
- [ ] Configurar Vite + Tailwind + shadcn/ui
- [ ] Implementar login y contexto de auth (Zustand + JWT)
- [ ] Dashboard admin con estadísticas básicas
- [ ] CRUD de rifas desde el panel

### Semana 4 — Público + Sorteo
- [ ] Landing pública por rifa (grilla de boletos)
- [ ] Flujo de reserva para comprador
- [ ] Buscador de boleto por número
- [ ] Página de sorteo con animación básica
- [ ] Generación de PDF del acta de sorteo
- [ ] Primer despliegue en VPS con dominio de prueba

**Entregable MVP:** Sistema funcional end-to-end con pago manual.

---

## FASE 2 — Pasarelas de Pago (Semanas 5–7)

### Semana 5 — Wompi
- [ ] Crear enlace de pago Wompi con referencia = payment.id
- [ ] Implementar y probar webhook Wompi con firma HMAC
- [ ] Flujo completo: reserva → pago online → confirmación automática
- [ ] Pruebas en sandbox Wompi

### Semana 6 — MercadoPago
- [ ] Crear preferencia de pago MercadoPago
- [ ] Implementar webhook y verificar firma
- [ ] Integrar botón de pago en la landing pública
- [ ] Pruebas en sandbox MercadoPago

### Semana 7 — Subida de imágenes
- [ ] Integrar Cloudinary (o AWS S3)
- [ ] Formulario de creación de rifa con upload de imágenes del premio
- [ ] Galería de imágenes en landing pública
- [ ] Optimización de imágenes (resize, WebP)

---

## FASE 3 — Notificaciones (Semana 8)

### Email (SendGrid)
- [ ] Configurar SendGrid (verificar dominio emisor)
- [ ] Email de confirmación de pago al comprador
- [ ] Email de ganador del sorteo

### WhatsApp (OpenWA)
- [ ] Levantar servicio OpenWA con `docker compose up openwa`
- [ ] Escanear QR en logs (`docker compose logs -f openwa`) con el número WhatsApp del cliente
- [ ] Verificar que la sesión queda guardada en volumen `openwa_session`
- [ ] WhatsApp de confirmación de pago (Celery task `notify_payment_confirmed`)
- [ ] WhatsApp al ganador del sorteo (Celery task `notify_winner`)
- [ ] Pruebas de extremo a extremo con números reales

> **Nota OpenWA:** La sesión WhatsApp se autentica una sola vez por cliente vía QR.
> El volumen `openwa_session` la persiste entre reinicios. Si el servidor cambia de IP
> o el número es desconectado desde el celular, hay que re-escanear.

---

## FASE 4 — Mejoras UI/UX (Semanas 9–10)

### Animación de sorteo
- [ ] Animación slot machine con Framer Motion (más elaborada)
- [ ] Confetti al mostrar ganador
- [ ] Sonido (opcional, configurable en tenant.config.json)

### Panel admin mejorado
- [ ] Gráficas de ventas por día/semana (Recharts)
- [ ] Filtros y búsqueda en lista de boletos
- [ ] Vista de pagos con filtro por estado
- [ ] Gestión de usuarios (crear vendedores)
- [ ] Exportación a PDF con logo del tenant

### Experiencia del comprador
- [ ] Contador regresivo hasta el sorteo
- [ ] Compartir en redes sociales (URL única por rifa)
- [ ] QR del boleto en el email de confirmación

---

## FASE 5 — Hardening y Producción (Semanas 11–12)

### Seguridad
- [ ] Rate limiting en API (slowapi)
- [ ] Sanitización de inputs
- [ ] CORS restrictivo por dominio del cliente
- [ ] Auditar webhooks (replay attack prevention)
- [ ] Secrets rotation procedure

### Observabilidad
- [ ] Logging estructurado (JSON) con nivel configurable
- [ ] Health check endpoints
- [ ] Alertas básicas con Uptime Robot o similares

### Performance
- [ ] Paginación en grilla de boletos para rifas grandes (>1000)
- [ ] Caché Redis para stats de rifa (invalidar al confirmar pago)
- [ ] Índices de BD verificados con EXPLAIN ANALYZE

### CI/CD (opcional)
- [ ] GitHub Actions para lint + tests en PR
- [ ] Script de actualización para clientes existentes (`docker compose pull && docker compose up -d`)

---

## Comandos de Desarrollo

```bash
# Levantar servicios de desarrollo
docker compose -f docker-compose.dev.yml up -d

# Crear primera migración
cd backend
alembic revision --autogenerate -m "initial_schema"
alembic upgrade head

# Crear admin inicial
python -c "
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
db = SessionLocal()
user = User(email='admin@demo.com', hashed_password=get_password_hash('admin123'), full_name='Admin', role=UserRole.admin)
db.add(user); db.commit()
print('Admin creado')
"

# Frontend dev
cd frontend
npm install
npm run dev

# Worker Celery
cd backend
celery -A app.core.celery_app worker --loglevel=debug
```

---

## Checklist de Despliegue por Cliente

- [ ] Copiar repositorio al VPS
- [ ] Crear `.env` con variables del cliente
- [ ] Personalizar `tenant.config.json` (nombre, logo, colores)
- [ ] Ejecutar `bash deploy/deploy.sh`
- [ ] Configurar SSL con Certbot
- [ ] Configurar Nginx con `deploy/nginx-proxy.conf`
- [ ] Verificar que `/health` responde 200
- [ ] Crear admin inicial
- [ ] Prueba end-to-end: crear rifa → reservar → confirmar → sortear
- [ ] Entregar credenciales de admin al cliente
