# Viewing Data

## Directory Navigation
### Moving up and down the tree
Directories can be navigated through by clicking on an option in the navigation bar on the right side of the screen. To move back up the tree to a previous location simply select the location (or its parent) from the list of previous locations in the breadcrumbs at the top.

![Navigate Folders](img/nav_folders.png)

### Searching
The search feature is currently only available within the `eSimMon-dashboard` directory within the `eSimMon` collection. This is the top level directory for the dashboard and is the location that you start at when first navigating to the page.

As you begin searching the drop-down menu will update with options that match your search.

![Search](img/search.png)

A single item can be selected from the menu or you can press enter or click the magnifying glass icon to return matching results. If there are multiple items that match the results will be prepended with their full path in order to make it easier to differentiate between the options. Clearing the search bar will return you to the previous location.

## Item Selection
### Displaying data
By default only 10 items are displayed at a time but this can be changed at the bottom of the navigation menu.

![Change Pagination](img/pagination.png)

To display multiple plots at once use the `+` and `-` arrows to add or remove rows or columns. Items can be dragged and dropped into any of the cells. Cells with plots currently displayed will be replaced with the newest selection.

![Adjust Number of Rows and Columns](img/rows_cols.png)

If the plot being displayed is a dynamic Plotly plot its data range for the current step can be viewed by hovering over the item name.

![Data Range](img/data_range.png)

### Playing steps
When an item is dropped into a cell the available plots will begin playing, displaying the next time step every second. This can be paused, resumed, or stepped through manually at the bottom of the navigation menu. When left playing the plots will continue to update as new data is ingested.

![Play Data](img/steps.png)

## Interacting with Plots
### Dynamic Plots
In addition to adding the `dashboard` top-scope section users will need to add a `plot-1D` section under `run` in their configuration file if they wish to generate interactive Plotly plots.


```bash
plot-1D:
    x: psi
    data: xgc.diagnosis.1d
    output: plotly
```

If `output` is omitted the generated plots will be static images. This option is currently only available for 1D data.

When an interactive plot is displayed in the dashboard the user is able to hover over the plot to see data values, zoom in or out of a selected region, toggle the way data is displayed on hover, and download the image as a `png` file. The toolbar that appears in the upper right corner allows you to select the different options.

![Plotly Plots](img/plotly.png)

### Movies
A movie of all of the available time steps can be downloaded by right-clicking on the plot itself.

![Movie Download](img/movie.png)

### Global Data Range
For dynamic plots right-clicking on the plot will also display a second option: `Set global range for {current parameter}`. Selecting this option will allow the user to set the y-axis range for all timesteps for the selected parameter. Selecting `Clear` and then saving the range will reset the axis to the default behavior of resizing based on the current timestep range.

![Range Dialog](img/range_dialog.png)