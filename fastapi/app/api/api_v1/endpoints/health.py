from typing import Dict
import io

from fastapi import APIRouter
from starlette.responses import StreamingResponse


router = APIRouter()


import numpy as np

@router.get(
    "",
    response_model=Dict[str, str],
)
def health():
    return {"status": "OK"}



data = None

@router.get(
    "/test",
    response_model=Dict[str, str],
)
def test():
    global data

    if data is None:
        data = np.random.bytes(1024 * 1024 * 5)

    return StreamingResponse(io.BytesIO(data), media_type="application/octet-stream")


