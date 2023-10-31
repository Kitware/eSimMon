import json
import shutil
import tempfile

import adios2 as adios
import numpy as np
from fastapi.responses import FileResponse

from fastapi import APIRouter
from fastapi import Header

from .utils import get_girder_client
from .variables import download_bp_file
from .variables import get_group_folder_id
from .variables import get_timestep_item

router = APIRouter()


def _write_data(output: adios.File, name: str, data: np.array) -> None:
    array = data
    shape = list(array.shape)
    count = [array.size]
    start = [] if shape == [] else [0]
    output.write(name, array, shape, start, count)


def write_to_bp_file(output: adios.File, input: adios.File, variable: str) -> None:
    plot_config = input.read_attribute_string(variable)
    if not output.read_attribute_string(variable):
        output.write_attribute(variable, plot_config)
    plot_config = json.loads(plot_config[0])

    if x_variable := plot_config.get("x"):
        x_data = input.read(x_variable)
        _write_data(output, x_variable, x_data)

    if y_variable := plot_config.get("y"):
        if not isinstance(y_variable, list):
            y_variable = [y_variable]
        for var in y_variable:
            y_data = input.read(var)
            _write_data(output, var, y_data)

    if color_variable := plot_config.get("color"):
        color_data = input.read(color_variable)
        _write_data(output, color_variable, color_data)

    if connectivity_variable := plot_config.get("connectivity"):
        connectivity_data = input.read(connectivity_variable)
        _write_data(output, connectivity_variable, connectivity_data)
    output.end_step()


@router.get("/{variable_id}/timesteps/raw")
async def get_raw_data(
    variable_id: str,
    girder_token: str = Header(None),
) -> FileResponse:
    gc = get_girder_client(girder_token)
    group_folder_id = get_group_folder_id(gc, variable_id)

    # Get all timesteps
    variable_item = gc.getItem(variable_id)
    time_steps = variable_item["meta"]["timesteps"]

    # Get the BP file name
    group_folder = gc.getFolder(group_folder_id)
    group_name = group_folder["name"]
    variable = variable_item["name"]
    bp_file_name = f"{variable}.bp"

    # One bp file per variable for all time steps
    output_dir = tempfile.mkdtemp(suffix=".bp")

    with tempfile.TemporaryDirectory() as tmpdir:
        with adios.open(output_dir, "w") as fh:
            for ts in time_steps:
                fh.write("time step", str(ts))
                get_timestep_item(gc, group_folder_id, ts)
                # Get the BP file for the timestep
                bp_file_path = await download_bp_file(
                    gc, tmpdir, group_folder["_id"], group_name, ts
                )
                # Extract data from the BP file
                with adios.open(str(bp_file_path), "r") as bp:
                    write_to_bp_file(fh, bp, variable)
        shutil.make_archive(bp_file_name, "zip", output_dir)

    return FileResponse(
        path=f"{bp_file_name}.zip", media_type=f"application/x-zip-compressed"
    )
