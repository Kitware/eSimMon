from typing import Dict

from .utils import MsgpackResponse


async def generate_colormap_response(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    y_variable = plot_config["y"]
    color_variable = plot_config["color"]
    x_label = plot_config["xlabel"]
    y_label = plot_config["ylabel"]
    title = plot_config["title"]

    x = bp_file.read(x_variable).data
    y = bp_file.read(y_variable).data
    color = bp_file.read(color_variable).data

    mesh_json = {
        "x": x,
        "y": y,
        "color": color,
        "xLabel": x_label,
        "yLabel": y_label,
        "colorLabel": color_variable,
        "title": title,
    }

    return MsgpackResponse(content=mesh_json)


async def generate_colormap_data(plot_config: Dict, bp_file, variable: str):
    return
