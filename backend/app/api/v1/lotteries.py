from fastapi import APIRouter, HTTPException, Query
from app.services.lottery import get_lotteries, get_result_by_date_and_slug, extract_winning_number

router = APIRouter(prefix="/lotteries", tags=["Loterías"])


@router.get("")
def list_lotteries():
    try:
        return get_lotteries()
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo obtener la lista de loterías")


@router.get("/result")
def get_lottery_result(
    date: str = Query(..., description="Fecha YYYY-MM-DD"),
    slug: str = Query(..., description="Slug de la lotería"),
    digits: int = Query(3, ge=2, le=3, description="Últimos 2 o 3 dígitos"),
):
    try:
        result = get_result_by_date_and_slug(date, slug)
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo consultar el resultado de la lotería")
    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró resultado para esa lotería el {date}. Es posible que aún no haya salido.",
        )
    winning_number = extract_winning_number(result, digits)
    return {
        "date": date,
        "lottery_slug": slug,
        "result_raw": result,
        "winning_number": winning_number,
        "digits_used": digits,
    }
