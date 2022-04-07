from typing import Any

import msgpack
from app.core.config import settings
from girder_client import GirderClient

from fastapi import HTTPException
from fastapi import Response

cache_settings = {
    "directory": "/tmp/cache",
    "eviction_policy": "least-frequently-used",
    "size_limit": 2**20,  # 1g
}

_gc = None


def get_girder_client(girder_token):

    if girder_token is None:
        raise HTTPException(status_code=400, detail="Invalid token.")

    global _gc
    if _gc is None:
        _gc = GirderClient(apiUrl=settings.GIRDER_API_URL, cacheSettings=cache_settings)

    _gc.setToken(girder_token)

    return _gc


class MsgpackResponse(Response):
    media_type = "application/msgpack"

    def render(self, content: Any) -> bytes:
        return msgpack.packb(content)
