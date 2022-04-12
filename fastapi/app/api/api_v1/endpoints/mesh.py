from typing import Dict

from .utils import MsgpackResponse


async def generate_mesh_response(plot_config: Dict, bp_file, variable: str):
    nodes_variable = plot_config["nodes"]
    connectivity_variable = plot_config["connectivity"]
    color_variable = plot_config["color"]
    x_label = plot_config["xlabel"]
    y_label = plot_config["ylabel"]
    title = plot_config["title"]

    nodes = bp_file.read(nodes_variable).data
    connectivity = bp_file.read(connectivity_variable).data
    color = bp_file.read(color_variable).data

    mesh_json = {
        "connectivity": connectivity,
        "nodes": nodes,
        "color": color,
        "xLabel": x_label,
        "yLabel": y_label,
        "colorLabel": color_variable,
        "title": title,
    }

    return MsgpackResponse(content=mesh_json)


async def generate_mesh_data(plot_config: Dict, bp_file, variable: str):
    return
