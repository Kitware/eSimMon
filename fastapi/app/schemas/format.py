from enum import Enum


class PlotFormat(str, Enum):
    plotly = "lines"
    mesh = "mesh-colormap"
