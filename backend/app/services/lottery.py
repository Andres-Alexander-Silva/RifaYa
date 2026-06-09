import httpx
from typing import Optional

LOTTERY_API_BASE = "https://api-resultadosloterias.com/api"


def get_lotteries() -> list[dict]:
    with httpx.Client(timeout=10) as client:
        r = client.get(f"{LOTTERY_API_BASE}/lotteries")
        r.raise_for_status()
        return r.json().get("data", [])


def get_result_by_date_and_slug(date: str, lottery_slug: str) -> Optional[str]:
    """Returns the raw 4-digit result string (e.g. '4185') or None if not found."""
    with httpx.Client(timeout=10) as client:
        r = client.get(f"{LOTTERY_API_BASE}/results/{date}")
        r.raise_for_status()
        data = r.json().get("data", [])
    for entry in data:
        if entry.get("slug") == lottery_slug:
            return entry.get("result")
    return None


def extract_winning_number(result: str, digits: int) -> int:
    """Extract last N digits from the lottery result string as an integer."""
    return int(result[-digits:])
