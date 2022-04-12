from app.api.api_v1.endpoints import health
from app.api.api_v1.endpoints import images
from app.api.api_v1.endpoints import movie
from app.api.api_v1.endpoints import variables

from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(movie.router, prefix="/movie", tags=["movie"])
api_router.include_router(variables.router, prefix="/variables", tags=["variables"])
api_router.include_router(images.router, prefix="/images", tags=["images"])
