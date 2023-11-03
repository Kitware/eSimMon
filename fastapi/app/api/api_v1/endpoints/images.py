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
from PIL import ImageDraw
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


class PlotDetails:
    def __init__(self, details=None) -> None:
        self._details = details if details else {}
        if isinstance(details, str):
            self._details = json.loads(unquote(details))

    @property
    def log_scaling(self):
        return self._details.get("log", False)

    @property
    def use_globals(self):
        return self._details.get("useRunGlobals", False)

    @property
    def x_range(self):
        return self._details.get("xRange", None)

    @property
    def y_range(self):
        return self._details.get("yRange", None)

    @property
    def scalarRange(self):
        return self._details.get("colorRange", None)

    @property
    def user_range(self):
        return self._details.get("userRange", {})

    @property
    def zoom(self):
        return self._details.get("zoom", {})

    @property
    def bounds(self):
        x, y, scalar = None, None, None

        if self.use_globals:
            x = self.x_range
            y = self.y_range
            scalar = self.scalarRange
        if self.user_range:
            x = self.user_range.get("x")
            y = self.user_range.get("y")
            scalar = self.user_range.get("scalar")
        if self.zoom:
            x = self.zoom.get("xAxis")
            y = self.zoom.get("yAxis")

        return x, y, scalar

    @property
    def camera_settings(self):
        fp, ss = None, None
        if self.zoom:
            fp = self.zoom.get("focalPoint", None)
            ss = self.zoom.get("serverScale", None)
        return fp, ss

    @property
    def show_legend(self):
        return self._details.get("showLegend", True)

    @property
    def show_x_axis(self):
        return self._details.get("showXAxis", True)

    @property
    def show_y_axis(self):
        return self._details.get("showYAxis", True)

    @property
    def show_scalar_bar(self):
        return self._details.get("showScalarBar", True)

    @property
    def show_title(self):
        return self._details.get("showTitle", True)

    @property
    def show_annotations(self):
        return self._details.get("rangeAnnotations", True)


def create_plotly_image(plot_data: dict, format: str, plot_details: PlotDetails):
    # The json contains Javascript syntax. Update values for Python
    plot_type = plot_data["type"]
    if plot_type != "bar":
        mode = "lines" if plot_type == "lines" else "markers"
        for data in plot_data["data"]:
            data["mode"] = mode

    plot_data["layout"]["autosize"] = True
    plot_data["layout"]["xaxis"]["automargin"] = True
    plot_data["layout"]["yaxis"]["automargin"] = True
    plot_data["layout"]["title"]["x"] = 0.5
    plot_data["layout"].pop("name", None)
    plot_data["layout"].pop("frames", None)

    x, y, _ = plot_details.bounds
    if x:
        plot_data["layout"]["xaxis"]["range"] = x
    if y:
        plot_data["layout"]["yaxis"]["range"] = y

    if plot_details.log_scaling:
        plot_data["layout"]["xaxis"]["type"] = "log"
        plot_data["layout"]["yaxis"]["type"] = "log"

    plot_data["layout"]["showlegend"] = plot_details.show_legend
    plot_data["layout"]["xaxis"]["visible"] = plot_details.show_x_axis
    plot_data["layout"]["yaxis"]["visible"] = plot_details.show_y_axis
    if not plot_details.show_title:
        plot_data["layout"]["title"]["text"] = ""

    # Get image as bytes
    fig = go.Figure(plot_data["data"], plot_data["layout"])
    output_file = tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False)
    fig.write_image(output_file.name, format=format)
    return _convert_image(output_file, format, plot_details)


def _convert_image(png_image, format: str, plot_details: PlotDetails):
    img = Image.open(png_image)
    if plot_details.show_annotations:
        draw = ImageDraw.Draw(img)
        x, y, scalar = plot_details.bounds
        text = f"X: {x}" if x else ""
        text = f"{text} Y: {y}" if y else text
        text = f"{text} Scalars: {scalar}" if scalar else text
        text_len = draw.textlength(text)
        position = ((img.width - text_len) // 2, img.height * 0.035)
        draw.text(position, text, fill=(0, 0, 0))
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
    def _retrieve_mesh_data(
        self, plot_type: str, plot_data: Dict, plot_details: PlotDetails
    ):
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
            x0, x1 = (
                plot_details.x_range
                if plot_details.use_globals
                else [min(xpoints), max(xpoints)]
            )
            y0, y1 = (
                plot_details.y_range
                if plot_details.use_globals
                else [min(ypoints), max(ypoints)]
            )
            scale = (y1 - y0) / (x1 - x0)

        return nodes, connectivity, scale

    def render_image(self, plot_data: Dict, format: str, plot_details: PlotDetails):
        plot_type = plot_data["type"]
        nodes, connectivity, scale = self._retrieve_mesh_data(
            plot_type, plot_data, plot_details
        )
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

        x, y, scalar = plot_details.bounds

        # Setup mapper and actor
        self.mesh_mapper.SetInputData(self.mesh)
        scalar_range = scalar if scalar else scalars.GetRange()
        self.mesh_mapper.SetScalarRange(scalar_range)

        self.title_text.SetInput(title)
        self.title_text.SetVisibility(plot_details.show_title)

        camera = vtkCamera()
        camera.SetParallelProjection(True)
        self.renderer.SetActiveCamera(camera)

        self.axes.SetCamera(self.renderer.GetActiveCamera())
        self.axes.SetXTitle(xLabel)
        self.axes.SetYTitle(yLabel)
        axes_bounds = self.mesh_actor.GetBounds()
        if x is not None and y is not None:
            axes_bounds = [*x, *y, 0, 0]
        self.axes.SetBounds(axes_bounds)

        # Needed to ensure grid axes is updated
        self.axes.DrawXGridlinesOff()
        self.axes.DrawYGridlinesOff()

        if not plot_details.show_x_axis:
            self.axes.XAxisVisibilityOff()
            self.axes.XAxisLabelVisibilityOff()
            self.axes.XAxisTickVisibilityOff()
        if not plot_details.show_y_axis:
            self.axes.YAxisVisibilityOff()
            self.axes.YAxisLabelVisibilityOff()
            self.axes.YAxisTickVisibilityOff()

        self.renderer.RemoveActor(self.axes)
        self.renderer.AddActor(self.axes)

        bounds = list(self.mesh_actor.GetBounds())
        if plot_type == PlotFormat.mesh:
            # TODO: Remove this when we have more functionality in VTK charts
            # Hack to manipulate the camera bounds
            # This ensures axes labels and title are not cut off
            bounds[2] -= 0.1
        elif plot_type == PlotFormat.colormap:
            if plot_details.use_globals:
                bounds[2] = plot_details.y_range[0]
                bounds[3] = plot_details.y_range[1]
            else:
                xscale, _, _ = self.mesh_actor.GetScale()
                bounds[1] += xscale * 0.1
        self.renderer.ResetCamera(bounds)
        self.renderer.SetBackground([1, 1, 1])

        # Set the zoom if needed
        focal_point, server_scale = plot_details.camera_settings
        if focal_point:
            camera = self.renderer.GetActiveCamera()
            fX, fY, fZ = focal_point
            camera.SetFocalPoint(fX, fY, fZ)
            camera.SetParallelScale(server_scale)

        self.scalar_bar.SetTitle(colorLabel)
        self.scalar_bar.SetVisibility(plot_details.show_scalar_bar)

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

        return _convert_image(output_file, format, plot_details)

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


def create_mesh_image(plot_data: dict, format: str, plot_details: PlotDetails):
    global pipeline

    return pipeline.render_image(plot_data, format, plot_details)


async def get_timestep_image_data(plot: dict, format: str, plot_details: PlotDetails):
    if plot["type"] in PlotFormat.plotly:
        image = create_plotly_image(plot, format, plot_details)
    elif plot["type"] == PlotFormat.mesh or plot["type"] == PlotFormat.colormap:
        image = create_mesh_image(plot, format, plot_details)
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
    plot_details = PlotDetails(details)
    # call generate plot response and get plot
    plot = await get_timestep_plot(variable_id, timestep, girder_token, as_image=True)
    img_bytes = await get_timestep_image_data(plot, format, plot_details)
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
    plot_details = PlotDetails(details)

    output_file = tempfile.NamedTemporaryFile(suffix=f".zip", delete=False)
    with zipfile.ZipFile(output_file, "w") as zip_obj:
        with tempfile.TemporaryDirectory() as tmpdir:
            for step in selectedTimeSteps:
                if step in timesteps:
                    # call generate plot response and get plot
                    plot = await get_timestep_plot(
                        variable_id, step, girder_token, as_image=True
                    )
                    image = await get_timestep_image_data(plot, "png", plot_details)
                    im = Image.open(io.BytesIO(image), "r", ["PNG"]).convert("RGB")
                    f = tempfile.NamedTemporaryFile(
                        dir=tmpdir, prefix=f"{step}_", suffix=f".{format}", delete=False
                    )
                    im.save(f.name, format.upper())
                    zip_obj.write(f.name, f"{step}.{format}")

        return FileResponse(
            path=output_file.name, media_type=f"application/x-zip-compressed"
        )
