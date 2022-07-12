from enum import Enum


class PlotFormat(str, Enum):
    plotly = ["lines", "bar", "scatter"]
    mesh = "mesh-colormap"
    colormap = "colormap"
