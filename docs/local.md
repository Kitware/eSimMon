# Running Locally

## Requirements
---------------

This following packages needs to be installed inorder to bring up the eSimMon stack:

- [docker](https://docs.docker.com/) - install instructions can be found [here](https://docs.docker.com/engine/install/)
- [docker-compose](https://docs.docker.com/compose/) - install instructions can be found [here](https://docs.docker.com/compose/install/)


## Outline of Services
----------------------
Bringing up the stack will create a series of Docker containers that allow the use of the eSimMon Dashboard, and each container supports a role in that process.

- ```docker-compose.girder.yml``` - Data management platform that uses MongoDB to store and retrieve data.
- ```docker-compose.ansible.yml``` - Ansible playbook to setup the Girder instance. The playbook will create one administrative user, an assetstore for storage, a collection for the data, a folder within that collection that will be the default location to upload the data to (this can be changed with the ```GIRDER_FOLDER_ID``` discussed in the section below), and the API key that the ```watch``` container will need.
- ```docker-compose.client.yml``` - Builds the client application and uses NGINX to make the app available on ```localhost:9090```.
- ```docker-compose.watch.yml``` - Runs a Python script to watch the simulation assets site (where the data is being hosted) and upload that data to Girder as it comes in.
- ```docker-compose.watch-standalone.yml``` - Runs the same monitoring code as ```docker-compose.watch.yml```, but does not require that the ```Girder``` container be run as well. Used to run the monitoring service outside of the stack.
- ```docker-compose.movie.yml``` - A Flask service that uses FFmpeg to create movies of the selected parameter's data, then downloads them to the local machine.
- ```docker-compose.demo.yml``` - A static simulation assets site that has been pre-populated with sample data and can be used as a simple way to populate and interact with the dashboard. This is set to be the default ```UPLOAD_SITE_URL```, which is what the ingest script in the ```watch``` container will watch for new data.


## Setting up the environment variables
---------------------------------------
To setup the Girder instance one admin user is created: ```esimmon```. The password for this user must be set in the ```.env``` file located in ```eSimMon/devops/docker``` under the ```ADMIN_PASSWORD``` key. Optionally, if a Girder instance has already been built the ```GIRDER_API_KEY``` and ```GIRDER_FOLDER_ID``` can be set in the ```watch.env``` file located in the same directory. If the keys are not set, they will be created automatically when the Girder instance is created. Changing the ```GIRDER_FOLDER_ID``` will change the location that files are uploaded to with the ingest script. The ```watch.env``` file also contains the ```UPLOAD_SITE_URL```, which should be set to the simulation assets URL.

The Girder instance now defaults to requiring email verification and admin approval for new users. This requires setting the ```SMTP_HOST```, ```SMTP_USERNAME```, ```SMTP_PASSWORD```, ```EMAIL_FROM```, and ```EMAIL_HOST``` in the ```.env``` file, as well as the appropriate email address for the adminstrator on line 26 in the [Ansible playbook](https://github.com/Kitware/eSimMon/blob/master/devops/ansible/site.yml#L26). Alternatively, the requirement for user verification and admin approval can be skipped altogether by commenting out the rules in [lines 86-93](https://github.com/Kitware/eSimMon/blob/master/devops/ansible/site.yml#L86-L93) of the Ansible playbook.


## Create and setup the Girder instance
---------------------------------------
To create the Girder instance, you will need to have set the ```ADMIN_PASSWORD``` key mentioned above, then run the following command:

    cd <repo>/devops/docker
    docker-compose -p esimmon -f docker-compose.girder.yml -f docker-compose.ansible.yml up

If successfull it will return ```esimmon_ansible_1 exited with code 0```, after which you can use ```ctrl-c``` to bring down the stack. This should only need to be run once for the initial setup. If the Girder database is removed and the setup needs to be re-run, the ```GIRDER_FOLDER_ID``` and ```GIRDER_API_KEY``` keys will need to be reset if they are not being manually set by the user. This can be done by running the following:

```git checkout -- <repo>/devops/docker/watch.env```


## Bringing up the stack
------------------------
To bring up the stack each time run the following command:

    cd <repo>/devops/docker
    docker-compose -p esimmon \
    -f docker-compose.client.yml \
    -f docker-compose.girder.yml \
    -f docker-compose.movie.yml \
    -f docker-compose.watch.yml \
    -f docker-compose.demo.yml up

The ```docker-compose.demo.yml``` file is optional and only needs to be included if you would like to use the sample data. The dashboard will then be exposed on ```localhost:9090```. When you access the dashboard you will see the login prompt, which is where you will enter the ```esimmon``` username and ```ADMIN_PASSWORD``` set in the ```.env``` file.

![Login Prompt](img/esimmon_login.png)

Once you have logged in, the dashboard should look like the following:

![eSimMon Dashboard](img/esimmon_dashboard.png)


## Bringing up the monitoring service with the stack
----------------------------------------------------
When the ```docker-compose.watch.yml``` file is included in the ```docker-compose``` command and the ```UPLOAD_SITE_URL``` has been set in the ```watch.env``` file, any existing run data will be ingested and any runs in progress will continue to populate the database as steps are completed. When the initial data has been ingested the watch script will continue to run, but you will know all existing data has been completely uploaded when you see the following:

```watch_1    | [date] [time] - adash - INFO - Fetching /shots/index.json```

This message will appear once every minute as the script continues to watch for new timesteps that may have been added. If there is an error message or you do not see the ```Fetching /shots/index.json``` message after the console output has slowed down or stopped, you can get help by creating an [issue](https://github.com/Kitware/eSimMon/issues/new) with the console output.


## Running the monitoring service separately
--------------------------------------------
In order to run the watch service outside of the stack, the following environment variables will need to be set inside the ```watch.env``` file:

- ```UPLOAD_SITE_URL``` - Should be the URL of the site that the data is being exposed on. This is what the script will monitor for new and existing timesteps.
- ```GIRDER_FOLDER_ID``` - The ID of the folder that the data should be uploaded to in the Girder database. This ID will need to be updated each time the upload location needs to be changed.
- ```GIRDER_API_KEY``` - The API key for the Girder instance that the data is being uploaded to. As explained above, this key will automatically be set when the Girder instance is created, but in order to use a different instance.
- ```GIRDER_API_URL``` - The URL for Girder instance that the data will be uploaded to.

The container can then be brought up with docker-compose:

    cd <repo>/devops/docker
    docker-compose -p esimmon -f docker-compose.watch-standalone.yml up

If the container starts up successfully you should see the following message at the very beginning, showing that the upload site set in the ```UPLOAD_SITE_URL``` is being watched for updates:

```watch_1  | [date] [time] - adash - INFO - Watching: [UPLOAD_SITE_URL]```

Once any pre-exisiting data is uploaded you will see messages indicating that the monitoring service is still running. The following message will appear every minute or so:

```watch_1  | [date] [time] - adash - INFO - Fetching /shots/index.json```

## Running with the monitoring service with EFFIS data
------------------------------------------------------
To run the dashboard with EFFIS you will need to take the following steps:

- Set the ```UPLOAD_SITE_URL``` variable in the ```watch.env``` file to be ```https://projects.olcf.ornl.gov/phy122/{username}/wdmapp-dashboard```
- Follow the instructions in the EFFIS [Read the Docs](https://wdmapp.readthedocs.io/en/latest/effis/dashboard.html) for enabling the dashboard
- You can then either:
    - Bring up either the whole stack, as explained in the ```Bringing up the stack``` section above (you will not need the ```docker-compose.demo.yml``` file)
    - Or run the monitioring service independently, as explained in the ```Running the monitoring service separately``` section above.

## Bringing down the stack
--------------------------
    docker-compose -p esimmon \
    -f docker-compose.client.yml \
    -f docker-compose.girder.yml \
    -f docker-compose.movie.yml \
    -f docker-compose.watch.yml \
    -f docker-compose.demo.yml down
