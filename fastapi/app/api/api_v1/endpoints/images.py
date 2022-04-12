import io

import plotly.graph_objects as go
from starlette.responses import StreamingResponse

from fastapi import APIRouter
from fastapi import Header

from .utils import get_girder_client
from .variables import get_timestep_plot

router = APIRouter()


def create_plotly_image(plot_data: dict, format: str):
    # The json contains Javascript syntax. Update values for Python
    for data in plot_data["data"]:
        data["mode"] = "lines"
    plot_data["layout"]["autosize"] = True
    plot_data["layout"]["xaxis"]["automargin"] = True
    plot_data["layout"]["yaxis"]["automargin"] = True
    plot_data["layout"].pop("name", None)
    plot_data["layout"].pop("frames", None)

    # Get image as bytes
    fig = go.Figure(plot_data["data"], plot_data["layout"])
    return fig.to_image(format, width=500, height=500)


def create_colormap_image(plot_data: dict, format: str):
    return


def create_mesh_image(plot_data: dict, format: str):
    return


async def get_timestep_image_data(plot: dict, format: str):
    if plot["type"] == "plotly":
        image = create_plotly_image(plot, format)
    elif plot["type"] == "mesh":
        image = create_mesh_image(plot, format)
    elif plot["type"] == "colormap":
        image = create_colormap_image(plot, format)
    return image


@router.get("/{variable_id}/timesteps/{timestep}/format/{image_type}")
async def get_timestep_image(
    variable_id: str, timestep: int, image_type: str, girder_token: str = Header(None)
):
    # Make sure time step exists
    gc = get_girder_client(girder_token)
    item = gc.getItem(variable_id)
    timesteps = item["meta"]["timesteps"]
    if timestep not in timesteps:
        timestep = max([s for s in timesteps if s < timestep])
    # call generate plot response and get plot
    plot = await get_timestep_plot(variable_id, timestep, girder_token, as_image=True)
    img_bytes = await get_timestep_image_data(plot, image_type)
    return StreamingResponse(io.BytesIO(img_bytes), media_type=f"image/{format}")
