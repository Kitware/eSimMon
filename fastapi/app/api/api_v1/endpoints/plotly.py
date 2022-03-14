from typing import Dict

import numpy as np


def generate_data(x: np.ndarray, y: np.ndarray, name: str):
    return {
        "name": name,
        "mode": "line",
        "type": "scatter",
        "x": x,
        "y": y,
    }


def generate_layout(title: str, x_label: str, y_label: str, name: str):
    return {
        "autosize": "true",
        "hovermode": "closest",
        "margin": {"l": 60, "t": 30, "b": 30, "r": 10},
        "title": {"text": title},
        "xaxis": {
            "type": "linear",
            "title": {"text": x_label, "standoff": 0},
            "automargin": "true",
        },
        "yaxis": {
            "type": "linear",
            "title": {"text": y_label, "standoff": 3},
            "automargin": "true",
        },
        "frames": [],
        "name": name,
    }


async def generate_plotly_json(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    x_label = plot_config["xlabel"]
    y_variables = plot_config["y"]
    y_names = plot_config["yname"]
    y_label = plot_config["ylabel"]

    data = []
    x = bp_file.read(x_variable).tolist()

    for (y_variable, y_name) in zip(y_variables, y_names):
        y = bp_file.read(y_variable).tolist()
        data.append(generate_data(x, y, y_name)),

    plotly_json = {
        "data": data,
        "layout": generate_layout(
            title=variable, x_label=x_label, y_label=y_label, name=variable
        ),
    }

    return plotly_json
