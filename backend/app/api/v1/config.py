from fastapi import APIRouter
from app.core.config import get_tenant_config

router = APIRouter(prefix="/config", tags=["Configuración"])


@router.get("")
def get_config():
    """Returns tenant config for the frontend (colors, logo, name)."""
    return get_tenant_config()
