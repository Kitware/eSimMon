# Ingesting Data

## Running with the monitoring service with EFFIS data
------------------------------------------------------

### Creating Visualizations

The [`XGC-visualization`](https://github.com/suchyta1/XGC-visualization/tree/dashboard) repo contains the `WDMApp-Simple-Diagnostics` script, which takes in two parameters: the path to the XGC data directory and the plot options yaml file (`--optsfile` or `-f`).

```bash
python WDMApp-Simple-Diagnostics.py /path/to/XGC_data -f options.yml
```

This script uses `wdmapp_reader` to translate the plots into the format that the dashboard expects - both the directory structure and naming. The `yaml` file that contains the plot options can be used to turn things on/off or select a subsample of time steps. As an example:

```yaml
diag3D:
  use: true
  write-adios: false

diag1D:
  use: true
```
##### Poincare Plots

Poincare plots are an exception to the rules above and require some additional tools to produce the plot output which can be found in [this GitLab repo] (https://gitlab.kitware.com/dpugmire/vtk-m/-/tree/poincare_xgc). In particular, the [Poincare examples](https://gitlab.kitware.com/dpugmire/vtk-m/-/tree/poincare_xgc/examples/poincare) may be useful.

Currently, the entire VTK-m instance is installed but there is work in progress to use an existing VTK-m installation if one exists. Additionally, it only operates on GPU per program call and on one ADIOS file/stream at a time. There is a [wrapper available](https://github.com/seunghoeku/XGC_analysis/blob/main/panout/adios2-panout.py) to appropriately break up the data for parallelism.

### Dashboard Packaging

The [existing packaging script](https://github.com/wdmapp/effis/blob/dashboard/plot/DashboardPackager.py) creates the expected directory structure and writes the data to a publicly accessible HTTP endpoint, but there is [work in progress](https://github.com/wdmapp/effis/blob/dashboard/plot/DashboardPackagerGlobus.py) to provide Globus support to move the data to the expected endpoint for ingest.

### NERSC Deployment

Data must currently be manually added to `/global/cfs/projectdirs/m499/esimmon/watch/shots` on Perlmutter in order for it to automatically be ingested and made available in the dashboard that is deployed at NERSC. Once Globus support has been made available data will be automatically moved and then ingested at the end of a run. For more information on this deployment see [Accessing the Dashboard](./access.md).

### AWS Deployment

Data written out to the public HTTP endpoint at `https://projects.olcf.ornl.gov/phy122/esuchyta/shots-local-3/shots` will be automatically ingested into the AWS instance and available in the dashboard that is deployed there. For more information on this deployment see the [Accessing the Dashboard](./access.md).

### Local Deployment

See the [developer's guide](../developer-guide/watch.md) for detailed information on running the watch script locally to ingest data.

## Running with the monitoring service with Catalyst data
---------------------------------------------------------

Coming Soon!
