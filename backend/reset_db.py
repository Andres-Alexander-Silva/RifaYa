"""
Limpia todos los datos de prueba manteniendo los usuarios.
Uso: python reset_db.py
     python reset_db.py --todo          # solo muestra cuántos registros hay
     python reset_db.py --incluir-users  # borra también todos los usuarios
"""
import sys
from sqlalchemy import text
from app.database import SessionLocal


def contar(db):
    tablas = ["draws", "tickets", "payments", "raffles", "users"]
    print("\nRegistros actuales:")
    for t in tablas:
        n = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
        print(f"  {t:<12} {n}")
    print()


def limpiar(db, incluir_users: bool = False):
    # 1. Romper el ciclo raffle ↔ ticket
    db.execute(text("UPDATE raffles SET winner_ticket_id = NULL"))

    # 2. Borrar en orden de dependencia
    db.execute(text("DELETE FROM draws"))
    db.execute(text("DELETE FROM tickets"))
    db.execute(text("DELETE FROM payments"))
    db.execute(text("DELETE FROM raffles"))

    if incluir_users:
        db.execute(text("DELETE FROM users"))

    db.commit()
    print("Base de datos limpia.")
    if not incluir_users:
        print("(usuarios conservados)")


if __name__ == "__main__":
    solo_ver = "--todo" in sys.argv
    incluir_users = "--incluir-users" in sys.argv

    db = SessionLocal()
    try:
        contar(db)
        if solo_ver:
            sys.exit(0)

        if not incluir_users:
            confirmacion = input("¿Borrar rifas, boletos y pagos? Los usuarios se conservan. [s/N] ")
        else:
            confirmacion = input("¿Borrar TODO incluyendo usuarios? [s/N] ")

        if confirmacion.strip().lower() == "s":
            limpiar(db, incluir_users=incluir_users)
            contar(db)
        else:
            print("Cancelado.")
    finally:
        db.close()
