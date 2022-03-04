from app.api.api_v1.endpoints import health, movie
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(movie.router, prefix="/movie", tags=["movie"])
