from typing import Dict

from .utils import MsgpackResponse


async def generate_scatter_data(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    x_label = plot_config["xlabel"]
    y_variable = plot_config["y"]
    y_label = plot_config["ylabel"]

    x = bp_file.read(x_variable).data
    y = bp_file.read(y_variable).data

    return {
        "x": x,
        "y": y,
        "xLabel": x_label,
        "yLabel": y_label,
        "type": "scatter",
        "title": variable,
    }


async def generate_scatter_response(plot_config: Dict, bp_file, variable: str):
    scatter_json = await generate_scatter_data(plot_config, bp_file, variable)
    return MsgpackResponse(content=scatter_json)
