# Proposed Static Site Interface
The basic idea here is to provide a simple hierarchy of JSON files that mimick a RESTful API. These can be used to monitor a number of runs and the parameters assocated with the runs. By breaking things down into a hierarchy the idea is that any of the individual files shouldn't get too large, so they can be fetched and parsed quickly within a polling loop.

` /runs/index.json` - The list of runs to monitor. This the top level file that will be monitored to identify which runs should be monitored.

```json
{
    "runs": ["<runName1>", "<runNameN>"]
}
```

`/runs/<runName>/meta.json` - Any metadata assocated with the run. 

```json
{
    "key1": "value1",
    "keyN": "valueN"
}
```
` /runs/<runName>/timestep.json` - The current timestep associated with this run. This would be monitored to determine when a new timestep is available for this run. -1 could be using to indicate that this run is complete, so monitoring of this run can be stopped.

```json
{
    "current": 1
}
```

`/runs/<runName>/parameters/index.json` - The list of parameters associated with the run.

```json
{
    "parameters": ["parameter1", "parameterN"]
}
```

`/runs/<runName>/parameters/<parameterName>/meta.json` - Any metadata associated with the parameter.

```json
{
    "key1": "value1",
    "keyN": "valueN"
}
```

`/runs/<runName>/parameters/<parameterName>/images/<timestep>.png` - The image associated with this particular parameter.
