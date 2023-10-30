from app.api.api_v1.endpoints import health
from app.api.api_v1.endpoints import images
from app.api.api_v1.endpoints import movie
from app.api.api_v1.endpoints import rawdata
from app.api.api_v1.endpoints import variables

from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(movie.router, prefix="/variables", tags=["movie"])
api_router.include_router(variables.router, prefix="/variables", tags=["variables"])
api_router.include_router(images.router, prefix="/variables", tags=["images"])
api_router.include_router(rawdata.router, prefix="/variables", tags=["rawdata"])
