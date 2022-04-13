import io
import json
import os
import tempfile
from typing import Optional
from urllib.parse import unquote

import ffmpeg
from fastapi.responses import FileResponse
from PIL import Image

from fastapi import APIRouter
from fastapi import Header

from .images import get_timestep_image_data
from .utils import get_girder_client
from .variables import get_timestep_plot

router = APIRouter()


@router.get("/{id}/format/{format}", response_class=FileResponse)
async def create_movie(
    id: str, format: str, zoom: Optional[str] = None, girder_token: str = Header(None)
):
    # Get all timesteps
    gc = get_girder_client(girder_token)
    item = gc.getItem(id)
    timesteps = item["meta"]["timesteps"]
    # Check if there are zoom settings to apply
    zoom = json.loads(unquote(zoom)) if zoom else {}
    with tempfile.TemporaryDirectory() as tmpdir:
        for step in timesteps:
            # call generate plot response and get plot
            plot = await get_timestep_plot(id, step, girder_token, as_image=True)
            image = await get_timestep_image_data(plot, "png", zoom)
            im = Image.open(io.BytesIO(image), "r", ["PNG"])
            f = tempfile.NamedTemporaryFile(
                dir=tmpdir, prefix=f"{step}_", suffix=".png", delete=False
            )
            im.save(f, "PNG")
        path_name = os.path.join(tmpdir, "*.png")
        output_file = tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False)
        try:
            (
                ffmpeg.input(path_name, pattern_type="glob", framerate=10)
                .output(output_file.name, **{"r": 30})
                .overwrite_output()
                .run()
            )
        except ffmpeg.Error as e:
            raise e

    return FileResponse(path=output_file.name, media_type=f"video/{format}")
