from typing import Dict

from fastapi import APIRouter

router = APIRouter()


@router.get(
    "",
    response_model=Dict[str, str],
)
def health():
    return {"status": "OK"}
