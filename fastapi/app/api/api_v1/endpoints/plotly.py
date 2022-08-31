from typing import Dict

import numpy as np
from fastapi.responses import JSONResponse


def generate_js_data(x: np.ndarray, y: np.ndarray, name: str):
    return {
        "name": name,
        "mode": "line",
        "type": "scatter",
        "x": x,
        "y": y,
    }


def generate_python_data(x: np.ndarray, y: np.ndarray, name: str):
    return {
        "name": name,
        "mode": "lines",
        "type": "scatter",
        "x": x,
        "y": y,
    }


def generate_js_layout(title: str, x_label: str, y_label: str, name: str):
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


def generate_python_layout(title: str, x_label: str, y_label: str):
    return {
        "autosize": True,
        "hovermode": "closest",
        "margin": {"l": 60, "t": 30, "b": 30, "r": 10},
        "title": {"text": title},
        "xaxis": {
            "type": "linear",
            "title": {"text": x_label, "standoff": 0},
            "automargin": True,
        },
        "yaxis": {
            "type": "linear",
            "title": {"text": y_label, "standoff": 3},
            "automargin": True,
        },
    }


async def generate_plotly_response(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    x_label = plot_config["xlabel"]
    y_variables = plot_config["y"]
    y_names = plot_config["yname"]
    y_label = plot_config["ylabel"]

    data = []
    x = bp_file.read(x_variable).tolist()

    for (y_variable, y_name) in zip(y_variables, y_names):
        y = bp_file.read(y_variable).tolist()
        data.append(generate_js_data(x, y, y_name)),

    plotly_json = {
        "data": data,
        "layout": generate_js_layout(
            title=variable, x_label=x_label, y_label=y_label, name=variable
        ),
    }

    return JSONResponse(
        media_type="application/vnd.plotly.v1+json", content=plotly_json
    )


async def generate_plotly_data(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    x_label = plot_config["xlabel"]
    y_variables = plot_config["y"]
    y_names = plot_config["yname"]
    y_label = plot_config["ylabel"]

    data = []
    x = bp_file.read(x_variable).tolist()

    for (y_variable, y_name) in zip(y_variables, y_names):
        y = bp_file.read(y_variable).tolist()
        data.append(generate_python_data(x, y, y_name)),

    plotly_json = {
        "data": data,
        "layout": generate_python_layout(
            title=variable, x_label=x_label, y_label=y_label
        ),
        "type": "lines",
    }

    return plotly_json
