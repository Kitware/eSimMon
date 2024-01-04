# Girder

[Girder](https://girder.readthedocs.io/en/latest/index.html) is an open-source, web-based data management platform for managing data. The platform includes built-in features for user management, authentication, and authorization control. Records are stored in a MongoDB.

This platform is how we manage and store the ingested data, as well as how we provision user accounts and set restrictions so that only users with approved email domains can access records for that instance.

## Requirements

```bash
docker pull kitware/esimmon-girder:latest
```

## Start the container

Please follow the instructions in the [Ansible](./ansible.md) documentation before running the Girder container, as this will take care of all of the initial setup that is required.

*Note*: The default settings limit the users that can view ingested data to those with `kitware.com`, `ornl.gov`, or `princeton.edu` email domains. This can be changed in the [ansible playbook](../../devops/ansible/site.yml) under `autojoin` if changed before the Ansible playbook has been run.

Once those steps have been completed you can run the container:

```bash
docker-compose -p esimmon -f path-to-repo/devops/docker/docker-compose.girder.yml up
```

You are now able to navigate to <http://localhost:8080> and login using the username `esimmon` and `ADMIN_PASSWORD` set in `path-to-repo/devops/docker/.env`.

### Plugins

By default two plugins are used: `Auto Join` and `eSimMon Plugin`.

#### Auto Join

The [autojoin](https://girder.readthedocs.io/en/latest/plugins.html#auto-join) plugin is what takes care of automatically assigning users to a group when they create an account. This automatic group assignment is what then gives them the permissions to view the data when they log into the dashboard.

#### eSimMon Plugin

The [eSimMon Plugin](../../girder/) is a [custom plugin](https://girder.readthedocs.io/en/latest/plugin-development.html) that we've developed to support additionaly functionality in the Girder database.

The first is a `search` endpoint that allows searching for child items of a given resource, and this is what we use for the search bar that we provide at the top of the dashboard's data browser.

The second is a new resource type called `View`. When users save their current layout this is the resouce that is updated with all of the relevant information for that `View` so that it can later be retireved and used to re-create that exact same layout of data.
