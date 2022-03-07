from girder_client import GirderClient

from app.core.config import settings
from fastapi import HTTPException

cache_settings = {
    "eviction_policy": "least-frequently-used",
    "size_limit": 2**20,  # 1g
}


def get_girder_client(girder_token):
    if girder_token is None:
        raise HTTPException(status_code=400, detail="Invalid token.")

    gc = GirderClient(apiUrl=settings.GIRDER_API_URL, cacheSettings=cache_settings)
    gc.setToken(girder_token)

    return gc
