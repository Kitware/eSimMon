import glob
import io
import json
import os
import tempfile
from typing import Optional
from typing import TypeAlias
from urllib.parse import unquote

import ffmpeg
from fastapi.responses import FileResponse
from PIL import Image

from fastapi import APIRouter
from fastapi import Header

from .images import PlotDetails
from .images import get_timestep_image_data
from .utils import get_girder_client
from .variables import get_group_folder_id
from .variables import get_timestep_item
from .variables import get_timestep_plot

router = APIRouter()

TempFile: TypeAlias = tempfile._TemporaryFileWrapper


async def _image_bytes(
    id: str, step: str, girder_token: str, as_image: bool, ext: str, details: dict
) -> io.BytesIO:
    plot = await get_timestep_plot(id, step, girder_token, as_image)
    if isinstance(plot, FileResponse):
        with Image.open(plot.path) as img:
            buf = io.BytesIO()
            img.save(buf, ext.upper())
        return buf
    else:
        plot_details = PlotDetails(details)
        image = await get_timestep_image_data(plot, ext, plot_details)
        return io.BytesIO(image)


def _save_file(
    gc, parent_id: str, data: io.BytesIO | TempFile, item: dict, ext: str
) -> None:
    new_fname = f"{item['name']}.{ext}"
    for f in gc.listFile(parent_id):
        if f["name"] == new_fname:
            return

    size = 0
    if isinstance(data, io.BytesIO):
        size = data.getbuffer().nbytes
    elif isinstance(data, TempFile):
        size = os.path.getsize(data.name)

    gc.uploadFile(
        parentId=parent_id,
        stream=data,
        name=new_fname,
        size=size,
        parentType="item",
        mimeType=f"image/{ext}",
    )


def _build_movie(input: TempFile, output: TempFile) -> None:
    ffmpeg.input(
        os.path.join(input, "*.jpeg"), pattern_type="glob", framerate=10
    ).filter("fps", fps=10, round="up").output(
        output.name, **{"r": 30}
    ).overwrite_output().run()


def _cleanup() -> None:
    # Make sure we don't start collecting temp movie files as they can get quite large
    path = f"{tempfile.gettempdir()}/esimmon*"
    for ext in ["mp4", "mpg"]:
        [os.remove(f) for f in glob.glob(f"{path}.{ext}")]


@router.get("/{id}/timesteps/movie", response_class=FileResponse)
async def create_movie(
    id: str,
    format: str,
    useDefault: bool = False,
    details: Optional[str] = None,
    selectedTimeSteps: Optional[str] = None,
    fps: Optional[str] = None,
    girder_token: str = Header(None),
) -> FileResponse:
    # Clean up any old temp files that might be hanging around
    _cleanup()

    # Get item information
    gc = get_girder_client(girder_token)
    item = gc.getItem(id)
    movie_id = gc.getItem(id)["meta"].get("movieItemId", None)
    files = list(gc.listFile(movie_id)) if movie_id else []

    # Get all timesteps
    timeSteps = item["meta"]["timesteps"]
    selectedTimeSteps = (
        json.loads(unquote(selectedTimeSteps)) if selectedTimeSteps else timeSteps
    )

    # Check if there are additional settings to apply
    float(fps) if fps else 10.0
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
        with tempfile.TemporaryDirectory(prefix="esimmon") as tmpdir:
            for step in selectedTimeSteps:
                if step not in timeSteps:
                    continue
                # call generate plot response and get plot
                bytes_io = await _image_bytes(
                    id, step, girder_token, True, "jpeg", details
                )
                im = Image.open(bytes_io, "r", ["JPEG"])
                f = tempfile.NamedTemporaryFile(
                    dir=tmpdir, prefix=f"{step}_", suffix=".jpeg", delete=False
                )
                im.save(f, "JPEG")
            output_file = tempfile.NamedTemporaryFile(
                prefix="esimmon", suffix=f".{format}", delete=False
            )
            try:
                _build_movie(tmpdir, output_file)
                _save_file(gc, movie_id, output_file, item, format)
            except ffmpeg.Error as e:
                raise e
    return FileResponse(path=output_file.name, media_type=f"video/{format}")


@router.put("/{id}/timesteps/movie")
async def save_movie(
    id: str,
    formats: str,
    girder_token: str = Header(None),
) -> None:
    # Clean up any old temp files that might be hanging around
    _cleanup()

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
        with tempfile.TemporaryDirectory(prefix="esimmon") as tmpdir:
            img_bytes = []
            for step in timeSteps:
                # call generate plot response and get plot
                bytes_io = await _image_bytes(id, step, girder_token, True, "jpeg", {})
                # save the static images for fast-play
                group_folder_id = get_group_folder_id(gc, id)
                time_step_item = get_timestep_item(gc, group_folder_id, step)
                _save_file(gc, time_step_item["_id"], bytes_io, item, "jpeg")
                img_bytes.append(ffmpeg.input(bytes_io))
                im = Image.open(bytes_io, "r", ["JPEG"])
                f = tempfile.NamedTemporaryFile(
                    dir=tmpdir, prefix=f"{step}_", suffix=".jpeg", delete=False
                )
                im.save(f, "JPEG")
            for format in formats:
                output_file = tempfile.NamedTemporaryFile(
                    prefix="esimmon", suffix=f".{format}", delete=False
                )
                try:
                    _build_movie(tmpdir, output_file)
                    _save_file(gc, movie_id, output_file, item, format)
                except ffmpeg.Error as e:
                    raise e
