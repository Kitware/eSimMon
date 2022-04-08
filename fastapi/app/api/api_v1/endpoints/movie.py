import glob
import os
import tempfile

from fastapi.responses import FileResponse

from fastapi import APIRouter
from fastapi import Header

from .utils import get_girder_client

router = APIRouter()


@router.get("/{id}", response_class=FileResponse)
def create_movie(id: str, girderToken: str = Header(None)):
    gc = get_girder_client(girderToken)
    with tempfile.TemporaryDirectory() as tmpdir:
        gc.downloadItem(id, tmpdir)
        item_name = os.listdir(tmpdir)[0]
        path_name = os.path.join(tmpdir, item_name, "*.svg")
        if len(glob.glob(path_name)) == 0:
            path_name = os.path.join(tmpdir, item_name, "*.png")
        output_file = tempfile.NamedTemporaryFile(suffix=".mp4")

        try:
            (
                ffmpeg.input(path_name, pattern_type="glob", framerate=10)
                .output(output_file.name)
                .overwrite_output()
                .run()
            )
        except ffmpeg.Error as e:
            raise e

        return output_file
