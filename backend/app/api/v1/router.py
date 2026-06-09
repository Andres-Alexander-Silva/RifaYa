from fastapi import APIRouter
from app.api.v1 import auth, users, raffles, tickets, payments, draws, reports, config, uploads, ws, lotteries

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(raffles.router)
api_router.include_router(tickets.router)
api_router.include_router(payments.router)
api_router.include_router(draws.router)
api_router.include_router(reports.router)
api_router.include_router(config.router)
api_router.include_router(uploads.router)
api_router.include_router(ws.router)
api_router.include_router(lotteries.router)
