import io
import json
import tempfile
from typing import Optional
from urllib.parse import unquote

import numpy as np
import plotly.graph_objects as go
from PIL import Image

# noinspection PyUnresolvedReferences
import vtkmodules.vtkInteractionStyle  # noqa

# noinspection PyUnresolvedReferences
import vtkmodules.vtkRenderingOpenGL2  # noqa
from PIL import Image
from starlette.responses import StreamingResponse
from vtkmodules.vtkCommonCore import vtkFloatArray
from vtkmodules.vtkCommonCore import vtkIdList
from vtkmodules.vtkCommonCore import vtkLookupTable
from vtkmodules.vtkCommonCore import vtkPoints
from vtkmodules.vtkCommonDataModel import vtkCellArray
from vtkmodules.vtkCommonDataModel import vtkPolyData
from vtkmodules.vtkIOImage import vtkPNGWriter
from vtkmodules.vtkRenderingAnnotation import vtkCubeAxesActor
from vtkmodules.vtkRenderingAnnotation import vtkScalarBarActor
from vtkmodules.vtkRenderingCore import vtkActor
from vtkmodules.vtkRenderingCore import vtkCamera
from vtkmodules.vtkRenderingCore import vtkColorTransferFunction
from vtkmodules.vtkRenderingCore import vtkPolyDataMapper
from vtkmodules.vtkRenderingCore import vtkRenderer
from vtkmodules.vtkRenderingCore import vtkRenderWindow
from vtkmodules.vtkRenderingCore import vtkWindowToImageFilter

from fastapi import APIRouter
from fastapi import Header

from .utils import get_girder_client
from .variables import get_timestep_plot

router = APIRouter()


def create_plotly_image(plot_data: dict, format: str, zoom: dict):
    # The json contains Javascript syntax. Update values for Python
    for data in plot_data["data"]:
        data["mode"] = "lines"
    plot_data["layout"]["autosize"] = True
    plot_data["layout"]["xaxis"]["automargin"] = True
    plot_data["layout"]["yaxis"]["automargin"] = True
    plot_data["layout"].pop("name", None)
    plot_data["layout"].pop("frames", None)
    if zoom:
        plot_data["layout"]["xaxis"]["range"] = zoom["xAxis"]
        plot_data["layout"]["yaxis"]["range"] = zoom["yAxis"]

    # Get image as bytes
    fig = go.Figure(plot_data["data"], plot_data["layout"])
    return fig.to_image(format, width=500, height=500)


def _convert_image(png_image, format: str):
    img = Image.open(png_image)
    img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format.upper())
    img.close()
    return buf.getvalue()


def _mkVtkIdList(it):
    # Makes a vtkIdList from a Python iterable.
    vil = vtkIdList()
    for i in it:
        vil.InsertNextId(int(i))
    return vil


def create_colormap_image(plot_data: dict, format: str):
    return


def create_mesh_image(plot_data: dict, format: str):
    nodes = np.asarray(plot_data["nodes"])
    connectivity = np.asarray(plot_data["connectivity"])
    color = np.asarray(plot_data["color"])
    xLabel = plot_data["xLabel"]
    yLabel = plot_data["yLabel"]
    colorLabel = plot_data["colorLabel"]
    # title = plot_data["title"]

    # We"ll create the building blocks of polydata including data attributes.
    mesh = vtkPolyData()
    points = vtkPoints()
    cells = vtkCellArray()
    scalars = vtkFloatArray()

    # Load the point, cell, and data attributes.
    for i, (x, y) in enumerate(nodes):
        points.InsertPoint(i, (x, y, 0.0))
    for pt in connectivity:
        cells.InsertNextCell(_mkVtkIdList(pt))
    for i, j in enumerate(color):
        scalars.InsertTuple1(i, j)

    # We now assign the pieces to the vtkPolyData.
    mesh.SetPoints(points)
    mesh.SetPolys(cells)
    mesh.GetPointData().SetScalars(scalars)

    # Setup mapper and actor
    mesh_mapper = vtkPolyDataMapper()
    mesh_mapper.SetInputData(mesh)
    mesh_mapper.SetScalarRange(scalars.GetRange())
    mesh_actor = vtkActor()
    mesh_actor.SetMapper(mesh_mapper)

    # Create a lookup table ad set the colormap
    ctf = vtkColorTransferFunction()
    # Build the Jet colormap
    ctf.SetColorSpaceToRGB()
    ctf.AddRGBPoint(-1, 0, 0, 0.5625)
    ctf.AddRGBPoint(-0.777778, 0, 0, 1)
    ctf.AddRGBPoint(-0.269841, 0, 1, 1)
    ctf.AddRGBPoint(-0.015873, 0.5, 1, 0.5)
    ctf.AddRGBPoint(0.238095, 1, 1, 0)
    ctf.AddRGBPoint(0.746032, 1, 0, 0)
    ctf.AddRGBPoint(1, 0.5, 0, 0)

    # Add the colormap to the lookup table
    lut = vtkLookupTable()
    # lut.SetHueRange(0.667, 0.0)
    lut.SetNumberOfColors(256)
    num_colors = lut.GetNumberOfColors()
    for i in range(num_colors):
        r, g, b = list(ctf.GetColor(float(i) / num_colors))
        lut.SetTableValue(i, r, g, b, 1.0)
    lut.SetTableRange(scalars.GetRange())
    lut.SetRampToLinear()
    lut.Build()
    mesh_mapper.SetLookupTable(lut)

    # The usual rendering stuff.
    camera = vtkCamera()
    camera.SetParallelProjection(True)

    renderer = vtkRenderer()
    ren_win = vtkRenderWindow()
    ren_win.AddRenderer(renderer)

    renderer.AddActor(mesh_actor)
    renderer.SetActiveCamera(camera)
    bounds = list(mesh_actor.GetBounds())
    bounds[2] -= 0.3
    renderer.ResetCamera(bounds)
    renderer.SetBackground([1, 1, 1])

    # Create the axis
    axes = vtkCubeAxesActor()
    axes.SetCamera(renderer.GetActiveCamera())
    axes.SetXTitle(xLabel)
    axes.SetYTitle(yLabel)
    axes.SetBounds(mesh_actor.GetBounds())
    axes.GetTitleTextProperty(0).SetColor(0, 0, 0)
    axes.GetLabelTextProperty(0).SetColor(0, 0, 0)
    axes.GetXAxesGridlinesProperty().SetColor(0, 0, 0)
    axes.XAxisMinorTickVisibilityOff()
    axes.DrawXGridlinesOn()
    axes.GetTitleTextProperty(1).SetColor(0, 0, 0)
    axes.GetLabelTextProperty(1).SetColor(0, 0, 0)
    axes.GetYAxesGridlinesProperty().SetColor(0, 0, 0)
    axes.YAxisMinorTickVisibilityOff()
    axes.DrawYGridlinesOn()
    axes.SetGridLineLocation(axes.VTK_GRID_LINES_FURTHEST)
    renderer.AddActor(axes)

    ren_win.SetSize(500, 500)
    ren_win.Render()

    # Build the colorbar
    scalar_bar = vtkScalarBarActor()
    scalar_bar.SetOrientationToHorizontal()
    scalar_bar.SetLookupTable(lut)
    scalar_bar.SetTitle(colorLabel)
    scalar_bar.SetNumberOfLabels(6)
    scalar_bar.UnconstrainedFontSizeOn()
    scalar_bar.SetMaximumWidthInPixels(20)
    scalar_bar.SetMaximumHeightInPixels(500)
    scalar_bar.SetOrientationToVertical()
    scalar_bar.GetLabelTextProperty().ShadowOff()
    scalar_bar.GetLabelTextProperty().SetColor(0, 0, 0)
    scalar_bar.GetLabelTextProperty().BoldOff()
    scalar_bar.GetLabelTextProperty().ItalicOff()
    scalar_bar.GetTitleTextProperty().ShadowOff()
    scalar_bar.GetTitleTextProperty().SetColor(0, 0, 0)
    scalar_bar.GetTitleTextProperty().BoldOff()
    scalar_bar.GetTitleTextProperty().ItalicOff()
    renderer.AddActor2D(scalar_bar)

    # Grab the plot as a png image
    w2if = vtkWindowToImageFilter()
    w2if.SetInput(ren_win)
    w2if.SetInputBufferTypeToRGB()
    w2if.ReadFrontBufferOff()
    w2if.Update()
    writer = vtkPNGWriter()
    output_file = tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False)
    writer.SetFileName(output_file.name)
    writer.SetInputConnection(w2if.GetOutputPort())
    writer.Write()
    return _convert_image(output_file, format)


async def get_timestep_image_data(plot: dict, format: str, zoom: dict):
    if plot["type"] == "plotly":
        image = create_plotly_image(plot, format, zoom)
    elif plot["type"] == "mesh":
        image = create_mesh_image(plot, format, zoom)
    elif plot["type"] == "colormap":
        image = create_colormap_image(plot, format, zoom)
    return image


@router.get("/{variable_id}/timesteps/{timestep}/format/{image_type}")
async def get_timestep_image(
    variable_id: str,
    timestep: int,
    image_type: str,
    zoom: Optional[str] = None,
    girder_token: str = Header(None),
):
    # Make sure time step exists
    gc = get_girder_client(girder_token)
    item = gc.getItem(variable_id)
    timesteps = item["meta"]["timesteps"]
    if timestep not in timesteps:
        timestep = max([s for s in timesteps if s < timestep])
    # Check if there are zoom settings to apply
    zoom = json.loads(unquote(zoom)) if zoom else {}
    # call generate plot response and get plot
    plot = await get_timestep_plot(variable_id, timestep, girder_token, as_image=True)
    img_bytes = await get_timestep_image_data(plot, image_type, zoom)
    return StreamingResponse(io.BytesIO(img_bytes), media_type=f"image/{format}")
