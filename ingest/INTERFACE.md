# Proposed Static Site Interface
The basic idea here is to provide a simple hierarchy of JSON files that mimick a RESTful API. These can be used to monitor a number of runs and the variables assocated with the runs. By breaking things down into a hierarchy the idea is that any of the individual files shouldn't get too large, so they can be fetched and parsed quickly within a polling loop.

` /shots/index.json` - The list of runs to monitor. The file will contain a list of objects contain the following properties:

- `shot_name` - Can be the same for multiple job submissions because it could be restarted during the next day, etc.
- `run_name`
- `username`
- `date`
- `machine_name` - could be summit, titan, …

For example:

```json
[{
    "shot_name": "myShot",
    "run_name": "myRun",
    "username": "cjh1",
    "data": "2019-05-16T15:54:35+0000"
}]
```

This is for a project. If we have multiple projects, then we need multiple dashboards; i.e. a dashboard per project.


`/shots/<shot_number>/<run_number>/time.json` - The current timestep associated with this run. This would be monitored to determine when a new timestep is available for this run. -1 could be using to indicate that this run is complete, so monitoring of this run can be stopped. Note that the current timestep should be incremented after all the files associated with the timestep have been written.

**TODO: Where do we get `shot_number` and `run_number` from? Should they be included in `/shots/index.json`?**

```json
{
    "current": 1
}
```

`/shots/<shot_number>/<run_number>/<physical_time>/variables.json` - The list of variables associated with the run.

```json
[{
    "variable_name": "myVar",
    "image_namge": "myVarImage.ong"
}]
```

**TODO: Where in the heiarchy will the images go? `/shots/<shot_number>/<run_number>/<physical_time>/images.tar.gz`?**

**TODO: What about metadata from the variables?**
