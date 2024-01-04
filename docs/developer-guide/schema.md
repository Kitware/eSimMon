# Directory Structure

In order for the ingest script to properly identify new runs and ingest the available data the following directory structure and json files are expected in the order and format described below.

```
shots/
  index.json
  {shot}/
    {run}/
      time.json
      {time_step_1}/
      ...
      {time_step_n}/
        variables.json
        images.tar.gz/
          {plot_category}/
          plots.json
          {variable_1}.png
          ...
          {variable_n}.png
          {plot_category}.bp
```

# File and directory expectations

## Shots Directory

The shots directory must be named `shots` and is the very top-level directory that the script is looking for. This should only need to be created once and new data will simply be added to it. Contains one or more [simulations](#simulations) as well as the [index.json](#indexjson) file.

## Simulation Directory

Contains one or more [runs](#run-directory).

## index.json

The index file contains a list of objects, where each object describes a simulation directory. This data is used to build the directory in the database and is used to associate runs with the correct simulation. The additonal keys are saved to the metadata. The `shot_name` and `run_name` keys are required. The `username`, `machine_name`, and `date` are optional. All keys expect string values.

```json
[
    {
        "shot_name": "my_shot_name",
        "run_name": "my_run_name",
        "username": "bnmajor",
        "machine_name": "crusher",
        "date": "2022-10-19T10:13:10+422603"
    }
]
```

## Run Directory

Contains a directory for each [time step](#time-step-directory) as well as the [time.json](#timejson) file.

## time.json

This file should be updated throughout the run for live runs. The `current` key is an integer that represents the current time step that the run is on. If the run is completed this will be the last time step. The `complete` key is a boolean that is used to indicate if the run is complete. The `started` key is a boolean that indicates if the run has been started. The `current` and `complete` keys are required and the `started` key is optional.

```json
{
    "current": 650,
    "complete": true,
    "started": true
}
```

## Time Step Directory

Contains an [images](#images-tarball) tarball as well as a [variables.json](#variablesjson) file.

## variables.json

The variables file should contain a list of objects, where each object describes a variable that is available for the current time step. The `file_name` is a string that describes the path to the plot data inside of the tarball. The `attribute_name` is the variable name and should be the key that the plot data is stored under in the bp file. The `group_name` is the group (the top-level directory in the tarball) that the plot belongs to. The `time` represents the actual time assocaited with this time step. All keys are required.

```json
[
    {
        "file_name": "heatload-images/650/hplot-heatload/HeatLoad-650.bp",
        "attribute_name": "eenflux side=0",
        "group_name": "Heat Load",
        "time": 0.0001514490625775283
    },
    {
        "file_name": "1D-images/650/visualization-1D/diag-1D.0.151449.bp",
        "attribute_name": "Elec. g.c. Density (m^-3)",
        "group_name": "diag-1D",
        "time": 0.00015144906257752824
    },
    {
        "file_name": "heat-images/650/visualization-heat/diag-heat.0.151449.bp",
        "attribute_name": "Heat (MW) [outboard]",
        "group_name": "diag-heat",
        "time": 0.00015144906257752824
    },
    {
        "file_name": "mesh-images/650/visualization-mesh/diag-mesh.0.151449.bp",
        "attribute_name": "Q_DPOT",
        "group_name": "diag-mesh",
        "time": 0.00015144906257752824
    }
]
```

## Images Tarball

Contains one or more [group](#groups) directories.

## Groups

Contains an [adios](#adios-file) (.bp) file, a [plots.json](#plots) file, and `png` image files for each variable available at this time step.

## plots.json

The plots file will contain the same json as the [variables.json](#variablesjson) file, but it will be limited to the variables that belong to this category/group.

```json
[
    {
        "file_name": "heatload-images/650/hplot-heatload/HeatLoad-650.bp",
        "attribute_name": "eenflux side=0",
        "group_name": "Heat Load",
        "time": 0.0001514490625775283
    }
]
```

## Adios File

### Attributes

There should be a json-stringified attribute for each each variable that contains the high-level information about the plot.

**Plotly Example**

One-dimensional plots are currently generated with Plotly and the `type` should indicate the plot type that is expected for this variable. The `x` key should be a string and will represent the variable that the x-axis data is stored under in the bp file. The `xlable` is also a string, but this is the *exact* string that will be used to label the x-axis. The `y` key should be a list of one or more strings that will represent the variable(s) that the y-axis data is stored under in the bp file. Similarly, the `yname` should also be a list the same length as the `y` key, with string values to be used when labeling data in the plot legend. The `ylabel` is actually the title of the plot.

```json
{
    "type": "lines",
    "x": "time",
    "y": ["enn=0", "enn=1", "enn=2", "enn=3"],
    "yname": ["n=0", "n=8", "n=16", "n=24"],
    "xlabel": "Time (ms)",
    "ylabel": "$\\sqrt{<|\\phi_n/T_0|^2>}$"
}
```

**Mesh Example**

Two-dimensional plots are currently generated with VTK. All values for these attribute values are expected to be strings and are used to indicate the variable that the data can be found under in the bp file. Additionally, for these plots the `type` tells us not just what type of plot should be produced but also what assumptions we can make about how connectivity data will be provided as well as how to handle this data client-side to produce the expected output.

- `mesh-colormap`: This plot type is assumed to share the same mesh connectivity across all time steps.
- `colormap` will build the mesh for each new time step. This will also tell the client-side to make some adjustments to the plot generation to produce the expected square plot.

The `nodes` key indicates the number of points that are being plotted and the `connectivity` value will point to the connectivty data. Much like the 1D plot data the `xlabel` will be used to label the `x-axis`, the `ylabel` will be used to label the y-axis, and the `title` will be used to assign the title of the plot. The `color` represents the scalar values used to color the plot.

```json
{
    "type": "mesh-colormap",
    "nodes": "mesh_rz",
    "connectivity": "mesh_conn",
    "color": "q_apars",
    "xlabel": "r (m)",
    "ylabel": "z (m)",
    "title": "$A_{||} C_s/T_e$ at 0.1514 ms"
}
```

**Colormap Example**
```json
{
    "type": "colormap",
    "x": "psi",
    "y": "timeflux",
    "color": "i_flux_r_2D",
    "xlabel": "Normalized Pol. Flux",
    "ylabel": "Time (ms)",
    "title": "Radial Heat Flux (MW)"
}
```

### Variables

Variable names are expected to exactly match what is in the attribute string and the data that is used client-side is currently exactly as it is stored in the bp file.

# Ingest a Run
*Detailed information coming soon*

# Questions or Comments

For questions about supporting a new plot type, data indestion, or current dashboard issues you can [open a new issue](https://github.com/Kitware/eSimMon/issues/new).

For questions and discussion around current directory and/or file structure or expectations feel free to start up (or expand on) a topic in our [discussions section](https://github.com/Kitware/eSimMon/discussions)!