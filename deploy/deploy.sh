#!/bin/bash
# Script de despliegue inicial para un nuevo cliente.
# Uso: bash deploy.sh

set -e

echo "========================================="
echo "  RifaYa — Deploy de nuevo cliente"
echo "========================================="

# 1. Variables
read -p "Dominio del cliente (ej: rifas.clienteA.com): " DOMAIN
read -p "Nombre de la BD (sin espacios): " DB_NAME
read -p "Contrasena BD (Enter para generar automaticamente): " DB_PASS

if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -base64 32 | tr -d '=/+' | head -c 32)
  echo "Contrasena BD generada: $DB_PASS"
fi

SECRET_KEY=$(openssl rand -base64 48)

# 2. Crear .env
cat > .env << ENV
# App
DB_NAME=${DB_NAME}
DB_USER=${DB_NAME}
DB_PASSWORD=${DB_PASS}
SECRET_KEY=${SECRET_KEY}
FRONTEND_URL=https://${DOMAIN}
RESERVATION_MINUTES=15

# Email (Gmail SMTP)
# App Password: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAILS_FROM_EMAIL=
EMAILS_FROM_NAME=RifaYa
ADMIN_EMAIL=

# WhatsApp (OpenWA - servicio externo)
# Ver: https://github.com/rmyndharis/OpenWA
# 1. Clonar repo y ejecutar: npm install && npm run start
# 2. Leer API key de data/.api-key
# 3. Crear sesion: POST /api/sessions  {"sessionId":"rifaya","config":{}}
# 4. Iniciar:      POST /api/sessions/rifaya/start
# 5. Escanear QR:  GET  /api/sessions/rifaya/qr-code
OPENWA_API_URL=https://openwa.${DOMAIN}/api
OPENWA_API_KEY=
OPENWA_SESSION_ID=rifaya

# Error tracking (Sentry) - dejar vacio para deshabilitar
SENTRY_DSN=

# Cloudinary - si vacio, imagenes se guardan en servidor local
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ENV

echo ".env creado en $(pwd)/.env"

# 3. Build y levantar servicios
docker compose build --no-cache
docker compose up -d

# 4. Ejecutar migraciones
echo "Esperando que la DB este lista..."
sleep 8
docker compose exec backend alembic upgrade head
echo "Migraciones aplicadas"

# 5. Crear admin inicial
read -p "Email del administrador: " ADMIN_EMAIL
read -s -p "Contrasena del administrador: " ADMIN_PASS
echo ""

docker compose exec backend python -c "
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
db = SessionLocal()
existing = db.query(User).filter(User.email == '${ADMIN_EMAIL}').first()
if existing:
    print('El usuario ya existe:', '${ADMIN_EMAIL}')
else:
    user = User(email='${ADMIN_EMAIL}', hashed_password=get_password_hash('${ADMIN_PASS}'), full_name='Administrador', role=UserRole.admin, is_active=True)
    db.add(user)
    db.commit()
    print('Admin creado:', '${ADMIN_EMAIL}')
db.close()
"

echo ""
echo "========================================="
echo "  Despliegue completado"
echo "  Dominio: https://${DOMAIN}"
echo "========================================="
echo ""
echo "Proximos pasos:"
echo "  1. SSL:     sudo certbot --nginx -d ${DOMAIN}"
echo "  2. Email:   completar SMTP_USER y SMTP_PASSWORD en .env"
echo "  3. Tenant:  ajustar tenant.config.json con datos del cliente"
echo "  4. WA:      seguir pasos en .env seccion OpenWA (opcional)"
echo ""
