from typing import Dict

import numpy as np
from fastapi.responses import JSONResponse


def generate_data(x: np.ndarray, y: np.ndarray, name: str, plot_type: str):
    data = {
        "name": name,
        "type": "scatter",
        "x": x,
        "y": y,
    }
    if plot_type == "bar":
        data["type"] = "bar"
    else:
        if plot_type == "lines":
            mode = "lines"
        elif plot_type == "scatter":
            mode = "markers"
        data["mode"] = mode
    return data


def generate_js_layout(
    title: str, x_label: str, y_label: str, name: str, plot_type: str
):
    layout = {
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
        "legend": {"display": "false"},
        "showlegend": "false",
    }
    if plot_type == "bar":
        layout["barmode"] = "stack"
    return layout


def generate_python_layout(title: str, x_label: str, y_label: str, plot_type: str):
    layout = {
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
    if plot_type == "bar":
        layout["barmode"] = "stack"
    return layout


async def generate_plotly_response(plot_config: Dict, bp_file, variable: str):
    x_variable = plot_config["x"]
    x_label = plot_config["xlabel"]
    y_variables = plot_config["y"]
    y_names = plot_config["yname"]
    y_label = plot_config["ylabel"]
    plot_type = plot_config["type"]

    data = []
    x = bp_file.read(x_variable).tolist()

    for (y_variable, y_name) in zip(y_variables, y_names):
        y = bp_file.read(y_variable).tolist()
        data.append(generate_data(x, y, y_name, plot_type)),

    plotly_json = {
        "data": data,
        "layout": generate_js_layout(
            title=variable,
            x_label=x_label,
            y_label=y_label,
            name=variable,
            plot_type=plot_type,
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
    plot_type = plot_config["type"]

    data = []
    x = bp_file.read(x_variable).tolist()

    for (y_variable, y_name) in zip(y_variables, y_names):
        y = bp_file.read(y_variable).tolist()
        data.append(generate_data(x, y, y_name, plot_type)),

    plotly_json = {
        "data": data,
        "layout": generate_python_layout(
            title=variable, x_label=x_label, y_label=y_label, plot_type=plot_type
        ),
        "type": plot_type,
    }

    return plotly_json
