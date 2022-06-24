import io
import json
import tempfile
import zipfile
from typing import Dict
from typing import Optional
from urllib.parse import unquote

import numpy as np
import plotly.graph_objects as go

# noinspection PyUnresolvedReferences
import vtkmodules.vtkInteractionStyle  # noqa

# noinspection PyUnresolvedReferences
import vtkmodules.vtkRenderingOpenGL2  # noqa
from app.schemas.format import PlotFormat
from fastapi.responses import FileResponse
from PIL import Image
from starlette.responses import StreamingResponse
from vtk.util import numpy_support
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
from vtkmodules.vtkRenderingCore import vtkTextActor
from vtkmodules.vtkRenderingCore import vtkWindowToImageFilter
from vtkmodules.vtkRenderingMatplotlib import vtkMatplotlibMathTextUtilities  # noqa

from fastapi import APIRouter
from fastapi import Header

from .utils import get_girder_client
from .variables import get_timestep_plot

router = APIRouter()


def create_plotly_image(plot_data: dict, format: str, details: dict):
    # The json contains Javascript syntax. Update values for Python
    for data in plot_data["data"]:
        data["mode"] = "lines"
    plot_data["layout"]["autosize"] = True
    plot_data["layout"]["xaxis"]["automargin"] = True
    plot_data["layout"]["yaxis"]["automargin"] = True
    plot_data["layout"]["title"]["x"] = 0.5
    plot_data["layout"].pop("name", None)
    plot_data["layout"].pop("frames", None)
    if details:
        log_scaling = details.get("log", False)
        if log_scaling:
            plot_data["layout"]["xaxis"]["type"] = "log"
            plot_data["layout"]["yaxis"]["type"] = "log"
        zoom = details.get("zoom", False)
        if zoom:
            plot_data["layout"]["xaxis"]["range"] = details["zoom"]["xAxis"]
            plot_data["layout"]["yaxis"]["range"] = details["zoom"]["yAxis"]

    # Get image as bytes
    fig = go.Figure(plot_data["data"], plot_data["layout"])
    return fig.to_image(format, width=1000, height=1000)


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


class MeshImagePipeline:
    def _retrieve_mesh_data(self, plot_type: str, plot_data: Dict):
        if plot_type == PlotFormat.mesh:
            nodes = np.asarray(plot_data["nodes"])
            connectivity = np.asarray(plot_data["connectivity"])
            scale = 1
        elif plot_type == PlotFormat.colormap:
            xpoints, ypoints = plot_data["x"], plot_data["y"]
            nodes, connectivity = [], []
            idx = 0
            for j in range(len(ypoints)):
                for i in range(len(xpoints)):
                    nodes.append([xpoints[i], ypoints[j]])
                    if i < len(xpoints) - 1 and j < len(ypoints) - 1:
                        connectivity.append(
                            [
                                idx,
                                idx + len(xpoints),
                                idx + len(xpoints) + 1,
                                idx + 1,
                                idx,
                            ]
                        )
                    idx += 1
            nodes = np.array(nodes)
            connectivity = np.array(connectivity)
            # TODO: Remove this when we have more functionality in VTK charts
            # Manipulate actor scale to ensure the plot remains square
            scale = (max(ypoints) - min(ypoints)) / (max(xpoints) - min(xpoints))

        return nodes, connectivity, scale

    def render_image(self, plot_data: Dict, format: str, details: Dict):
        plot_type = plot_data["type"]
        nodes, connectivity, scale = self._retrieve_mesh_data(plot_type, plot_data)
        color = np.asarray(plot_data["color"])

        if color.ndim > 1:
            color = color.flatten()
        xLabel = plot_data["xLabel"]
        yLabel = plot_data["yLabel"]
        colorLabel = plot_data["colorLabel"]
        title = plot_data["title"]

        if self.points is None or plot_data != self.prev_plot_type:
            self.points = vtkPoints()
            for i, (x, y) in enumerate(nodes):
                self.points.InsertPoint(i, (x, y, 0.0))
            self.mesh.SetPoints(self.points)
        if self.cells is None or plot_data != self.prev_plot_type:
            # For now we can cache mesh as the connectivity is the  for mesh plots
            self.cells = vtkCellArray()
            for pt in connectivity:
                self.cells.InsertNextCell(_mkVtkIdList(pt))
            self.mesh.SetPolys(self.cells)

        # TODO: Remove this when we have more functionality in VTK charts
        # Manipulate actor scale to ensure the plot remains square
        self.mesh_actor.SetScale(scale, 1, 1)

        scalars = numpy_support.numpy_to_vtk(color)

        # We now assign the pieces to the vtkPolyData.
        self.mesh.GetPointData().SetScalars(scalars)

        # Setup mapper and actor
        self.mesh_mapper.SetInputData(self.mesh)
        self.mesh_mapper.SetScalarRange(scalars.GetRange())

        self.title_text.SetInput(title)

        camera = vtkCamera()
        camera.SetParallelProjection(True)
        self.renderer.SetActiveCamera(camera)

        self.axes.SetCamera(self.renderer.GetActiveCamera())
        self.axes.SetXTitle(xLabel)
        self.axes.SetYTitle(yLabel)
        self.axes.SetBounds(self.mesh_actor.GetBounds())

        # Needed to ensure grid axes is updated
        if plot_type == PlotFormat.mesh:
            self.axes.DrawXGridlinesOn()
            self.axes.DrawYGridlinesOn()
        elif plot_type == PlotFormat.colormap:
            self.axes.DrawXGridlinesOff()
            self.axes.DrawYGridlinesOff()
        self.renderer.RemoveActor(self.axes)
        self.renderer.AddActor(self.axes)

        bounds = list(self.mesh_actor.GetBounds())
        if plot_type == PlotFormat.mesh:
            # TODO: Remove this when we have more functionality in VTK charts
            # Hack to manipulate the camera bounds
            # This ensures axes labels and title are not cut off
            bounds[2] -= 0.1
        elif plot_type == PlotFormat.colormap:
            xscale, _, _ = self.mesh_actor.GetScale()
            bounds[1] += xscale * 0.1
        self.renderer.ResetCamera(bounds)
        self.renderer.SetBackground([1, 1, 1])

        # Set the zoom if needed
        if details and (zoom := details.get("zoom", False)):
            camera = self.renderer.GetActiveCamera()
            fX, fY, fZ = zoom["focalPoint"]
            camera.SetFocalPoint(fX, fY, fZ)
            camera.SetParallelScale(zoom["serverScale"])

        self.scalar_bar.SetTitle(colorLabel)

        self.ren_win.Render()

        # Grab the plot as a png image
        w2if = vtkWindowToImageFilter()
        w2if.SetInput(self.ren_win)
        w2if.SetInputBufferTypeToRGB()
        w2if.ReadFrontBufferOff()
        w2if.Update()

        output_file = tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False)
        self.writer.SetFileName(output_file.name)
        self.writer.SetInputConnection(w2if.GetOutputPort())
        self.writer.Write()

        self.prev_plot_type = plot_type

        return _convert_image(output_file, format)

    def __init__(self):
        # Note previous plot type in order to take advantage of caching
        self.prev_plot_type = None
        # We"ll create the building blocks of polydata including data attributes.
        self.mesh = vtkPolyData()
        self.points = None  # vtkPoints()
        self.cells = None  # vtkCellArray()

        # Setup mapper and actor
        self.mesh_mapper = vtkPolyDataMapper()

        self.mesh_actor = vtkActor()
        self.mesh_actor.SetMapper(self.mesh_mapper)

        # Add the colormap to the lookup table
        lut = vtkLookupTable()
        # Build and set the Jet colormap
        lutNum = 256
        lut.SetNumberOfTableValues(lutNum)
        ctf = vtkColorTransferFunction()
        ctf.SetColorSpaceToRGB()
        cl = []
        cl.append([float(cc) / 255.0 for cc in [0, 0, 143.4375]])
        cl.append([float(cc) / 255.0 for cc in [0, 0, 255]])
        cl.append([float(cc) / 255.0 for cc in [0, 255, 255]])
        cl.append([float(cc) / 255.0 for cc in [127.5, 255, 127.5]])
        cl.append([float(cc) / 255.0 for cc in [255, 255, 0]])
        cl.append([float(cc) / 255.0 for cc in [255, 0, 0]])
        cl.append([float(cc) / 255.0 for cc in [127.5, 0, 0]])
        vv = [float(xx) / float(len(cl) - 1) for xx in range(len(cl))]
        for pt, color in zip(vv, cl):
            ctf.AddRGBPoint(pt, color[0], color[1], color[2])
        for ii, ss in enumerate([float(xx) / float(lutNum) for xx in range(lutNum)]):
            cc = ctf.GetColor(ss)
            lut.SetTableValue(ii, cc[0], cc[1], cc[2], 1.0)
        self.mesh_mapper.SetLookupTable(lut)

        self.renderer = vtkRenderer()
        self.ren_win = vtkRenderWindow()
        self.ren_win.AddRenderer(self.renderer)

        self.renderer.AddActor(self.mesh_actor)

        # Set the title
        self.title_text = vtkTextActor()
        self.title_text_prop = self.title_text.GetTextProperty()
        self.title_text_prop.SetJustificationToCentered()
        self.title_text_prop.SetVerticalJustificationToTop()
        self.title_text_prop.SetFontFamilyToArial()
        self.title_text_prop.SetFontSize(18)
        self.title_text_prop.SetColor([0, 0, 0])
        self.title_text_prop.SetJustificationToCentered()
        self.title_text_prop.SetVerticalJustificationToTop()
        self.title_text.SetPosition(500, 980)
        self.renderer.AddActor2D(self.title_text)

        # Create the axis
        self.axes = vtkCubeAxesActor()
        self.axes.SetUse2DMode(0)
        self.axes.SetCamera(self.renderer.GetActiveCamera())
        self.axes.GetTitleTextProperty(0).SetColor(0, 0, 0)
        self.axes.GetLabelTextProperty(0).SetColor(0, 0, 0)
        self.axes.GetXAxesGridlinesProperty().SetColor(0, 0, 0)
        self.axes.GetXAxesLinesProperty().SetColor(0, 0, 0)
        self.axes.XAxisMinorTickVisibilityOff()
        self.axes.GetTitleTextProperty(1).SetColor(0, 0, 0)
        self.axes.GetLabelTextProperty(1).SetColor(0, 0, 0)
        self.axes.GetYAxesGridlinesProperty().SetColor(0, 0, 0)
        self.axes.GetYAxesLinesProperty().SetColor(0, 0, 0)
        self.axes.YAxisMinorTickVisibilityOff()

        self.ren_win.SetSize(1000, 1000)

        # Build the colorbar
        self.scalar_bar = vtkScalarBarActor()
        self.scalar_bar.SetOrientationToHorizontal()
        self.scalar_bar.SetLookupTable(lut)
        self.scalar_bar.SetNumberOfLabels(6)
        self.scalar_bar.UnconstrainedFontSizeOn()
        self.scalar_bar.SetMaximumWidthInPixels(40)
        self.scalar_bar.SetMaximumHeightInPixels(1000)
        self.scalar_bar.SetDisplayPosition(850, 100)
        self.scalar_bar.SetOrientationToVertical()
        self.scalar_bar.GetLabelTextProperty().ShadowOff()
        self.scalar_bar.GetLabelTextProperty().SetColor(0, 0, 0)
        self.scalar_bar.GetLabelTextProperty().BoldOff()
        self.scalar_bar.GetLabelTextProperty().ItalicOff()
        self.scalar_bar.GetTitleTextProperty().ShadowOff()
        self.scalar_bar.GetTitleTextProperty().SetColor(0, 0, 0)
        self.scalar_bar.GetTitleTextProperty().BoldOff()
        self.scalar_bar.GetTitleTextProperty().ItalicOff()
        self.renderer.AddActor2D(self.scalar_bar)

        # Setup image filter
        self.writer = vtkPNGWriter()


pipeline = MeshImagePipeline()


def create_mesh_image(plot_data: dict, format: str, details: dict):
    global pipeline

    return pipeline.render_image(plot_data, format, details)


async def get_timestep_image_data(plot: dict, format: str, details: dict):
    if plot["type"] == PlotFormat.plotly:
        image = create_plotly_image(plot, format, details)
    elif plot["type"] == PlotFormat.mesh or plot["type"] == PlotFormat.colormap:
        image = create_mesh_image(plot, format, details)
    else:
        raise Exception("Unrecognized type")

    return image


@router.get("/{variable_id}/timesteps/{timestep}/image")
async def get_timestep_image(
    variable_id: str,
    timestep: int,
    format: str,
    details: Optional[str] = None,
    girder_token: str = Header(None),
):
    # Make sure time step exists
    gc = get_girder_client(girder_token)
    item = gc.getItem(variable_id)
    timesteps = item["meta"]["timesteps"]
    if timestep not in timesteps:
        timestep = max([s for s in timesteps if s < timestep])
    # Check if there are additional settings to apply
    details = json.loads(unquote(details)) if details else {}
    # call generate plot response and get plot
    plot = await get_timestep_plot(variable_id, timestep, girder_token, as_image=True)
    img_bytes = await get_timestep_image_data(plot, format, details)
    return StreamingResponse(io.BytesIO(img_bytes), media_type=f"image/{format}")


@router.get("/{variable_id}/timesteps/image")
async def get_timestep_images(
    variable_id: str,
    format: str,
    selectedTimeSteps: str = None,
    details: Optional[str] = None,
    girder_token: str = Header(None),
):
    # Get all timesteps
    gc = get_girder_client(girder_token)
    item = gc.getItem(variable_id)
    timesteps = item["meta"]["timesteps"]
    # Check if there are specific time steps to use
    if selectedTimeSteps:
        selectedTimeSteps = json.loads(unquote(selectedTimeSteps))
    else:
        selectedTimeSteps = timesteps
    # Check if there are additional settings to apply
    details = json.loads(unquote(details)) if details else {}

    output_file = tempfile.NamedTemporaryFile(suffix=f".zip", delete=False)
    with zipfile.ZipFile(output_file, "w") as zip_obj:
        with tempfile.TemporaryDirectory() as tmpdir:
            for step in selectedTimeSteps:
                if step in timesteps:
                    # call generate plot response and get plot
                    plot = await get_timestep_plot(
                        variable_id, step, girder_token, as_image=True
                    )
                    image = await get_timestep_image_data(plot, "png", details)
                    im = Image.open(io.BytesIO(image), "r", ["PNG"]).convert("RGB")
                    f = tempfile.NamedTemporaryFile(
                        dir=tmpdir, prefix=f"{step}_", suffix=f".{format}", delete=False
                    )
                    im.save(f.name, format.upper())
                    zip_obj.write(f.name, f"{step}.{format}")

        return FileResponse(
            path=output_file.name, media_type=f"application/x-zip-compressed"
        )
