from enum import Enum


class PlotFormat(str, Enum):
    plotly = ["lines", "bar"]
    mesh = "mesh-colormap"
    colormap = "colormap"
    scatter = "scatter"
