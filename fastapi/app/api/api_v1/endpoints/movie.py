import glob
import io
import json
import os
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import unquote

import ffmpeg
from fastapi.responses import FileResponse
from PIL import Image

from fastapi import APIRouter
from fastapi import Header

from .images import PlotDetails
from .images import get_timestep_image_data
from .utils import get_girder_client
from .variables import get_timestep_plot

router = APIRouter()


def _cleanup():
    # Make sure we don't start collecting temp movie files as they can get quite large
    path = f"{tempfile.gettempdir()}/esimmon*"
    for ext in ["mp4", "mpg"]:
        [os.remove(f) for f in glob.glob(f"{path}.{ext}")]


async def _create_movie(
    id: str,
    formats: list[str],
    details: Optional[dict] = None,
    timeSteps: Optional[str] = None,
    selectedTimeSteps: Optional[str] = None,
    framerate: Optional[float] = None,
    girder_token: str = Header(None),
):
    # Clean up any old temp files that might be hanging around
    _cleanup()

    selectedTimeSteps = (
        json.loads(unquote(selectedTimeSteps)) if selectedTimeSteps else timeSteps
    )

    with tempfile.TemporaryDirectory(prefix="esimmon") as tmpdir:
        for step in selectedTimeSteps:
            if step in timeSteps:
                # call generate plot response and get plot
                plot = await get_timestep_plot(id, step, girder_token, as_image=True)
                plot_details = PlotDetails(details)
                image = await get_timestep_image_data(plot, "png", plot_details)
                im = Image.open(io.BytesIO(image), "r", ["PNG"])
                f = tempfile.NamedTemporaryFile(
                    dir=tmpdir, prefix=f"{step}_", suffix=".png", delete=False
                )
                im.save(f, "PNG")
        path_name = os.path.join(tmpdir, "*.png")
        results = []
        for format in formats:
            output_file = tempfile.NamedTemporaryFile(
                prefix="esimmon", suffix=f".{format}", delete=False
            )
            try:
                (
                    ffmpeg.input(path_name, pattern_type="glob", framerate=framerate)
                    .output(output_file.name, **{"r": 30})
                    .overwrite_output()
                    .run()
                )
                results.append(output_file)
            except ffmpeg.Error as e:
                raise e

    return results


@router.get("/{id}/timesteps/movie", response_class=FileResponse)
async def create_movie(
    id: str,
    format: str,
    useDefault: bool = False,
    details: Optional[str] = None,
    selectedTimeSteps: Optional[str] = None,
    fps: Optional[str] = None,
    girder_token: str = Header(None),
):
    # Get item information
    gc = get_girder_client(girder_token)
    item = gc.getItem(id)
    movie_id = gc.getItem(id)["meta"].get("movieItemId", None)
    files = list(gc.listFile(movie_id)) if movie_id else []

    # Get all timesteps
    timeSteps = item["meta"]["timesteps"]

    # Check if there are additional settings to apply
    framerate = float(fps) if fps else 10.0
    details = json.loads(unquote(details)) if details else {}

    found_exts = [os.path.splitext(f["name"])[-1] for f in files]
    if useDefault and f".{format}" in found_exts:
        # The user is requesting the default movie, grab the pre-generated one
        file_id = files[found_exts.index(f".{format}")]["_id"]
        output_file = tempfile.NamedTemporaryFile(
            prefix="esimmon", suffix=f".{format}", delete=False
        )
        gc.downloadFile(file_id, output_file.name)
    else:
        # This is a customized movie, generate it now
        output_files = await _create_movie(
            id, [format], details, timeSteps, selectedTimeSteps, framerate, girder_token
        )
        output_file = output_files[0]
    return FileResponse(path=output_file.name, media_type=f"video/{format}")


@router.put("/{id}/timesteps/movie")
async def save_movie(
    id: str,
    formats: str,
    girder_token: str = Header(None),
):
    # Get item information
    gc = get_girder_client(girder_token)
    item = gc.getItem(id)
    movie_id = gc.getItem(id)["meta"].get("movieItemId", None)
    files = list(gc.listFile(movie_id)) if movie_id else []
    formats = json.loads(unquote(formats))

    # Get all timesteps
    timeSteps = item["meta"]["timesteps"]

    found_exts = [os.path.splitext(f["name"])[-1] for f in files]
    missing_exts = [f for f in formats if f".{f}" not in found_exts]
    if missing_exts:
        # We don't have the default movie(s) saved yet, generate them now
        output_files = await _create_movie(
            id, missing_exts, {"legend": False}, timeSteps, None, 10.0, girder_token
        )
        for out in output_files:
            ext = Path(out.name).suffix
            gc.uploadFile(
                parentId=movie_id,
                stream=out,
                name=f"{item['name']}{ext}",
                size=os.stat(out.name).st_size,
                parentType="item",
                mimeType=f"video/{ext}",
            )
