# RifaYa — Guía de despliegue en Render

## Costo estimado mensual

| Servicio | Plan | Costo |
|---------|------|-------|
| Backend API (`rifaya-api`) | Starter | $7 USD/mes |
| Celery Worker (`rifaya-worker`) | Starter | $7 USD/mes |
| PostgreSQL (`rifaya-db`) | Free (90 días) → Starter | $0 → $7 USD/mes |
| Redis (`rifaya-redis`) | Free (25 MB) | $0 |
| Frontend (`rifaya-frontend`) | Static Site | Gratis |
| **Total** | | **~$14/mes (primeros 90 días) → ~$21/mes** |

---

## Requisitos previos

- Cuenta en [render.com](https://render.com) (tarjeta de crédito para los servicios de pago)
- Cuenta en GitHub con el repositorio del proyecto
- Cuenta en [Cloudinary](https://cloudinary.com) — necesaria para imágenes en Render (filesystem efímero)
- Gmail con **App Password** configurado (para emails)

---

## Paso 1 — Crear el repositorio en GitHub

Si aún no tienes el repositorio en GitHub:

```bash
# Desde la raíz del proyecto
cd /Users/ingkun/Proyectos/RifaYa

git init
git add .
git commit -m "Initial commit"

# Crear repo en GitHub (requiere gh CLI instalado)
gh repo create rifaya --private --source=. --push

# Alternativa: crear el repo manualmente en github.com
# y luego ejecutar:
git remote add origin https://github.com/TU_USUARIO/rifaya.git
git branch -M main
git push -u origin main
```

**Verificar que el `.gitignore` excluye:**
- `.env` y `.env.*` — nunca subir secretos al repo
- `node_modules/`, `dist/`, `__pycache__/`, `.venv/`
- `uploads/*` (excepto `.gitkeep`)
- `postgres_data/`, `redis_data/`

---

## Paso 2 — Conectar Render con GitHub

1. Ve a [dashboard.render.com](https://dashboard.render.com)
2. Haz clic en **New** → **Blueprint**
3. Conecta tu cuenta de GitHub si no lo has hecho
4. Selecciona el repositorio `rifaya`
5. Render detectará automáticamente el archivo `render.yaml` en la raíz del proyecto
6. Haz clic en **Apply** para iniciar el despliegue

Render creará todos los servicios definidos en `render.yaml`:
- `rifaya-db` (PostgreSQL)
- `rifaya-redis` (Redis)
- `rifaya-api` (Web Service — backend)
- `rifaya-worker` (Background Worker — Celery)
- `rifaya-frontend` (Static Site — React)

El primer despliegue tomará entre 5 y 15 minutos.

---

## Paso 3 — Configurar variables de entorno secretas

Las variables marcadas con `sync: false` en `render.yaml` no se configuran automáticamente. Debes establecerlas manualmente en el dashboard de Render.

### En el servicio `rifaya-api`

Ve a: **Dashboard → rifaya-api → Environment**

| Variable | Valor |
|----------|-------|
| `SMTP_USER` | Tu cuenta Gmail, ej: `tucuenta@gmail.com` |
| `SMTP_PASSWORD` | App Password de Google (16 caracteres, sin espacios) |
| `EMAILS_FROM_EMAIL` | Igual a `SMTP_USER` |
| `ADMIN_EMAIL` | Tu correo — recibirá alertas de pagos pendientes |
| `CLOUDINARY_CLOUD_NAME` | Nombre de tu cuenta Cloudinary |
| `CLOUDINARY_API_KEY` | API Key de Cloudinary |
| `CLOUDINARY_API_SECRET` | API Secret de Cloudinary |
| `FRONTEND_URL` | URL del frontend asignada por Render, ej: `https://rifaya-frontend.onrender.com` |
| `BACKEND_CORS_ORIGINS` | `["https://rifaya-frontend.onrender.com"]` |

> **Cómo obtener el App Password de Gmail:**
> Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones → Seleccionar app "Correo" → Copiar las 16 letras

> **Cómo obtener las credenciales de Cloudinary:**
> [cloudinary.com/console](https://cloudinary.com/console) → Dashboard → Cloud name, API Key, API Secret

### En el servicio `rifaya-frontend`

Ve a: **Dashboard → rifaya-frontend → Environment**

| Variable | Valor |
|----------|-------|
| `VITE_API_BASE_URL` | URL del backend + `/api/v1`, ej: `https://rifaya-api.onrender.com/api/v1` |

> Esta variable se usa en el **build** del frontend. Después de guardarla, debes hacer un nuevo despliegue manual del frontend: **Manual Deploy → Deploy latest commit**.

---

## Paso 4 — Verificar el despliegue

### Revisar los logs

En cada servicio, ve a la pestaña **Logs**:

**rifaya-api** — debe verse algo así al final:
```
Running migrations: alembic upgrade head
INFO  [alembic.runtime.migration] Running upgrade ...
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:10000
```

**rifaya-worker** — debe verse:
```
celery@... ready.
[queues]
. reservations
. notifications
```

**rifaya-frontend** — en la pestaña Events:
```
Build successful
Deploy live
```

### Probar el health check

```bash
curl https://rifaya-api.onrender.com/health
# Respuesta esperada:
# {"status":"ok","db":"ok","redis":"ok"}
```

### Probar el frontend

Abre `https://rifaya-frontend.onrender.com` en el navegador. Debes ver la landing page de RifaYa.

---

## Paso 5 — Crear el usuario administrador

Una vez que el backend esté corriendo, crea el primer usuario admin desde la consola de Render.

1. Ve a **Dashboard → rifaya-api → Shell**
2. Ejecuta:

```bash
python app/scripts/create_admin.py
```

El script pedirá nombre completo, email y contraseña. Guarda estas credenciales — las necesitas para entrar al panel admin.

---

## Paso 6 — Llenar el `tenant.config.json`

Edita el archivo `/tenant.config.json` en tu repositorio local con los datos reales y sube los cambios:

```json
{
  "name": "Nombre de tu empresa de rifas",
  "tagline": "Tu slogan aquí",
  "supportPhone": "+57 300 123 4567",
  "supportEmail": "soporte@tudominio.com",
  "whatsappUrl": "https://wa.me/573001234567",
  "payment": {
    "nequiPhone": "300 123 4567",
    "bankName": "Bancolombia",
    "bankAccount": "1234567890",
    "bankAccountHolder": "Nombre del titular",
    "bankQRUrl": "",
    "cashInstructions": "Comunícate con nosotros por WhatsApp para coordinar el pago.",
    "proofInstructions": "Sube la foto o captura del comprobante de transferencia."
  }
}
```

Luego empuja los cambios:

```bash
git add tenant.config.json
git commit -m "Configure tenant data"
git push
```

Render detectará el push y redesplegará automáticamente.

---

## Paso 7 — Subir el logo y favicon

Los archivos `logo.png` y `favicon.ico` deben estar en el directorio `frontend/public/` del repositorio. Reemplázalos con los de tu cliente y haz push — Render redesplegará el frontend automáticamente.

---

## Flujo de redeploy continuo

Cada vez que hagas `git push` a la rama `main`:
1. Render detecta el cambio
2. Reconstruye los servicios afectados automáticamente
3. El backend ejecuta `alembic upgrade head` antes de iniciar (pre-deploy command)

Para forzar un redeploy sin cambios de código:
- **Dashboard → [servicio] → Manual Deploy → Deploy latest commit**

---

## Troubleshooting

### El backend no arranca — error de base de datos

```
sqlalchemy.exc.OperationalError: could not connect to server
```

- Ve a **Dashboard → rifaya-db** y verifica que el servicio de PostgreSQL esté en estado `Available`
- La variable `DATABASE_URL` es inyectada automáticamente por Render via `fromDatabase` — no la edites manualmente

### El frontend no llama al backend — error de CORS

```
Access to XMLHttpRequest blocked by CORS policy
```

- Verifica que `FRONTEND_URL` en `rifaya-api` tiene exactamente la URL de `rifaya-frontend` (sin `/` al final)
- Verifica que `BACKEND_CORS_ORIGINS` tiene el mismo valor entre corchetes: `["https://rifaya-frontend.onrender.com"]`
- Después de cambiar estas variables, el servicio se reinicia automáticamente

### El frontend no encuentra el backend — 404 en `/api/v1/...`

- Verifica que `VITE_API_BASE_URL` en `rifaya-frontend` apunta al backend: `https://rifaya-api.onrender.com/api/v1`
- Esta variable es de **build time** — después de guardarla debes hacer **Manual Deploy** del frontend

### Las imágenes subidas no aparecen tras redeploy

- Render borra el filesystem local en cada deploy
- **Solución:** configura las variables `CLOUDINARY_*` en `rifaya-api`
- Sin Cloudinary, las imágenes del comprobante se perderán en cada deploy

### El worker Celery no procesa tareas

- Ve a **Dashboard → rifaya-worker → Logs** y verifica que esté corriendo
- Verifica que `REDIS_URL` sea correcto (inyectado automáticamente desde `rifaya-redis`)
- Si ves errores de conexión al broker, reinicia el worker: **Manual Deploy → Deploy latest commit**

### El plan gratuito de PostgreSQL expiró (90 días)

- Render enviará un email de aviso antes de la expiración
- Ve a **Dashboard → rifaya-db → Upgrade** y selecciona el plan Starter ($7/mes)
- La URL de la base de datos no cambia — no necesitas actualizar variables

---

## Resumen de URLs

Después del despliegue tendrás estas URLs:

| Servicio | URL |
|---------|-----|
| Frontend (público) | `https://rifaya-frontend.onrender.com` |
| Backend API | `https://rifaya-api.onrender.com` |
| API Health | `https://rifaya-api.onrender.com/health` |
| API Docs (Swagger) | `https://rifaya-api.onrender.com/docs` |
| API Docs (Redoc) | `https://rifaya-api.onrender.com/redoc` |
| Panel admin | `https://rifaya-frontend.onrender.com/admin` |

---

## Checklist de go-live

- [ ] Repositorio en GitHub creado y código subido
- [ ] Blueprint desplegado en Render (todos los servicios en verde)
- [ ] Variables secretas configuradas en `rifaya-api` (SMTP, Cloudinary)
- [ ] `VITE_API_BASE_URL` configurada en `rifaya-frontend` + redeploy
- [ ] `FRONTEND_URL` y `BACKEND_CORS_ORIGINS` configuradas en `rifaya-api`
- [ ] Health check responde `{"status":"ok","db":"ok","redis":"ok"}`
- [ ] Usuario admin creado via Shell de Render
- [ ] `tenant.config.json` con datos reales subido al repo
- [ ] Logo y favicon reales subidos al repo
- [ ] Login en `/admin` funciona con el usuario creado
- [ ] Crear una rifa de prueba y completar el flujo de compra end-to-end
- [ ] Verificar que llega el email de confirmación de pago
- [ ] Verificar que las imágenes del comprobante se suben a Cloudinary
