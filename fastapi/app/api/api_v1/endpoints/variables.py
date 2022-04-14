import json
import tarfile
import tempfile
from pathlib import Path

import adios2
from app.schemas.format import PlotFormat

from fastapi import APIRouter
from fastapi import Header
from fastapi import HTTPException

from .colormap import generate_colormap_response
from .mesh import generate_mesh_data
from .mesh import generate_mesh_response
from .plotly import generate_plotly_data
from .plotly import generate_plotly_response
from .utils import get_girder_client

router = APIRouter()


def get_group_folder_id(gc, variable_item_id):
    return gc.getItem(variable_item_id)["folderId"]


def get_timestep_folder_id(gc, group_folder_id):
    return next(
        gc.listFolder(group_folder_id, parentFolderType="folder", name="timesteps")
    )["_id"]


def get_run_folder_id(gc, group_folder_id):
    return gc.getFolder(group_folder_id)["parentId"]


def get_timesteps_folder_id(gc, group_folder_id):
    run_folder_id = get_run_folder_id(gc, group_folder_id)

    timesteps_folder = list(gc.listFolder(run_folder_id, name="timesteps"))
    if len(timesteps_folder) != 1:
        raise HTTPException(status_code=404, details="Timesteps folder not found.")

    return timesteps_folder[0]["_id"]


def get_timestep_item(gc, group_folder_id, timestep):
    timesteps_folder_id = get_timesteps_folder_id(gc, group_folder_id)

    timestep_item = list(gc.listItem(timesteps_folder_id, name=f"{timestep:04}"))
    if len(timestep_item) != 1:
        raise HTTPException(status_code=404, detail="Timestep not found.")

    return timestep_item[0]


def get_timestep_bp_file_id(gc, group_folder_id, group_name, timestep):
    filename = f"{group_name}.bp.tgz"

    timestep_item = get_timestep_item(gc, group_folder_id, timestep)

    for bp_file in gc.listFile(timestep_item["_id"]):
        if bp_file["name"] == filename:
            return bp_file["_id"]

    raise HTTPException(status_code=404, detail="Unable to locate BP file.")


async def download_bp_file(
    gc, output_dir: str, group_folder_id: str, group_name: str, timestep: int
):
    file_id = get_timestep_bp_file_id(gc, group_folder_id, group_name, timestep)

    bp_path = Path(output_dir) / f"{group_name}.bp.tgz"
    gc.downloadFile(file_id, str(bp_path))
    tar = tarfile.open(bp_path)
    # Get the name of the BP file
    bp_filename = tar.getnames()[0]
    # Extract contents
    tar.extractall(output_dir)
    tar.close()

    return Path(output_dir) / bp_filename


async def generate_plot_response(bp, variable: str):
    plot_config = bp.read_attribute_string(variable)
    plot_config = json.loads(plot_config[0])

    plot_type = plot_config["type"]

    if plot_type == PlotFormat.plotly:
        return await generate_plotly_response(plot_config, bp, variable)
    elif plot_type == PlotFormat.mesh:
        return await generate_mesh_response(plot_config, bp, variable)
    elif plot_type == PlotFormat.colormap:
        return await generate_colormap_response(plot_config, bp, variable)

    raise HTTPException(status_code=400, detail="Unsupported plot type.")


async def generate_plot_data(bp, variable: str):
    plot_config = bp.read_attribute_string(variable)
    plot_config = json.loads(plot_config[0])

    plot_type = plot_config["type"]

    if plot_type == PlotFormat.plotly:
        return await generate_plotly_data(plot_config, bp, variable)
    elif plot_type == PlotFormat.mesh:
        return await generate_mesh_data(plot_config, bp, variable)

    raise HTTPException(status_code=400, detail="Unsupported plot type.")


@router.get("/{variable_id}/timesteps")
async def get_timesteps(variable_id: str, girder_token: str = Header(None)):
    gc = get_girder_client(girder_token)

    item = gc.getItem(variable_id)
    meta = item["meta"]

    return {"steps": meta["timesteps"], "time": meta["time"]}


# variable_id => Girder item id for item used to represent the variable.
@router.get("/{variable_id}/timesteps/{timestep}/plot")
async def get_timestep_plot(
    variable_id: str,
    timestep: int,
    girder_token: str = Header(None),
    as_image: bool = False,
):
    gc = get_girder_client(girder_token)
    group_folder_id = get_group_folder_id(gc, variable_id)
    get_timestep_item(gc, group_folder_id, timestep)
    # Get the variable name (the item name)
    variable_item = gc.getItem(variable_id)
    variable = variable_item["name"]

    # Get the BP file for the timestep
    group_folder = gc.getFolder(group_folder_id)
    group_name = group_folder["name"]
    f"{group_name}.bp.tgz"

    with tempfile.TemporaryDirectory() as tmpdir:
        bp_file_path = await download_bp_file(
            gc, tmpdir, group_folder["_id"], group_name, timestep
        )
        # Extract data from the BP file
        with adios2.open(str(bp_file_path), "r") as bp:
            if as_image:
                return await generate_plot_data(bp, variable)
            else:
                return await generate_plot_response(bp, variable)
