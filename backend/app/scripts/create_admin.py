"""
Script para crear un usuario administrador.

Uso:
    cd backend
    python -m app.scripts.create_admin

O con argumentos:
    python -m app.scripts.create_admin --email admin@ejemplo.com --name "Admin" --password "miClave123"
"""
import argparse
import sys
import os

# Añade el directorio raíz al path para que funcionen los imports de la app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlalchemy.exc import IntegrityError


def create_admin(email: str, full_name: str, password: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"⚠️  Ya existe un usuario con el email {email}")
            if existing.role != UserRole.admin:
                existing.role = UserRole.admin
                db.commit()
                print("✅  Rol actualizado a admin.")
            else:
                print("ℹ️   Ya es admin. No se realizaron cambios.")
            return

        user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"✅  Admin creado exitosamente:")
        print(f"    Email:    {user.email}")
        print(f"    Nombre:   {user.full_name}")
        print(f"    Rol:      {user.role.value}")
        print(f"    ID:       {user.id}")
    except IntegrityError:
        db.rollback()
        print("❌  Error: ya existe un usuario con ese email.")
    except Exception as e:
        db.rollback()
        print(f"❌  Error inesperado: {e}")
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Crear usuario administrador")
    parser.add_argument("--email", help="Email del admin")
    parser.add_argument("--name", help="Nombre completo")
    parser.add_argument("--password", help="Contraseña")
    args = parser.parse_args()

    email = args.email or input("Email: ").strip()
    name = args.name or input("Nombre completo: ").strip()

    if args.password:
        password = args.password
    else:
        import getpass
        password = getpass.getpass("Contraseña: ")
        confirm = getpass.getpass("Confirmar contraseña: ")
        if password != confirm:
            print("❌  Las contraseñas no coinciden.")
            sys.exit(1)

    if len(password) < 6:
        print("❌  La contraseña debe tener al menos 6 caracteres.")
        sys.exit(1)

    create_admin(email, name, password)


if __name__ == "__main__":
    main()
