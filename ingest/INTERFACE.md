# Proposed Static Site Interface
The basic idea here is to provide a simple hierarchy of JSON files that mimick a RESTful API. These can be used to monitor a number of runs and the variables assocated with the runs. By breaking things down into a hierarchy the idea is that any of the individual files shouldn't get too large, so they can be fetched and parsed quickly within a polling loop.

` /runs/index.json` - The list of runs to monitor. This the top level file that will be monitored to identify which runs should be monitored.

```json
["<runName1>", "<runNameN>"]
```

`/runs/<runName>/meta.json` - Any metadata assocated with the run. 

```json
{
    "key1": "value1",
    "keyN": "valueN"
}
```
` /runs/<runName>/timestep.json` - The current timestep associated with this run. This would be monitored to determine when a new timestep is available for this run. -1 could be using to indicate that this run is complete, so monitoring of this run can be stopped. Note that the current timestep should be incremented after all the files associated with the timestep have been written.

```json
{
    "current": 1
}
```

`/runs/<runName>/variables/index.json` - The list of variables associated with the run.

```json
["variable1", "variableN"]
```

`/runs/<runName>/variables/<variableName>/meta.json` - Any metadata associated with the variable. One example of a useful piece of metadata would be the 'stride' of the variable ( if its available ), as in, is a image for this parameter produced every timestep or every N timesteps.

```json
{
    "key1": "value1",
    "keyN": "valueN"
}
```

`/runs/<runName>/variables/<variableName>/images/<timestep>.png` - The image associated with this particular variable.
