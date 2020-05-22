Setting up the environment variables
------------------------------------
To setup the Girder instance two users are created: ```esimmonadmin``` and ```esimmon```. The passwords for these users must be set in the ```.env``` file located in ```eSimMon/devops/docker``` under the ```ADMIN_PASSWORD``` and ```ESIMMON_PASSWORD``` keys. Optionally, if a Girder instance has already been built the ```GIRDER_API_KEY``` and ```GIRDER_FOLDER_ID``` can be set in the ```watch.env``` file located in the same directory. If the keys are not set, they will be created automatically when the Girder instance is created.


Create and setup the Girder instance
------------------------------------
To create the Girder instance, you will need to have set the ```ADMIN_PASSWORD``` and ```ESIMMON_PASSWORD``` keys mentioned above, then run the following command:

```docker-compose -p esimmon -f docker-compose.girder.yml -f docker-compose.ansible.yml up```

This will create both users, as well as an assetstore, collection, default folder, and API key in order to allow the ingest script to populate the database with data from the virtual machine run. This should only need to be run once for the initial setup.


Populating Girder
---------------
When the ```docker-compose.watch.yml``` file is included in the ```docker-compose``` command and the virtual machine is running, any existing run data will be ingested and any runs in progress will continue to populate the database as steps are completed. The virtual machine must be started before the stack is brought up.


Bringing up the stack
---------------------
To bring up the stack each time run the following command:

    docker-compose \
    -f docker-compose.client.yml \
    -f docker-compose.girder.yml \
    -f docker-compose.movie.yml \
    -f docker-compose.watch.yml up

The ```docker-compose.watch.yml``` file is optional and should not be included if the virtual machine is not being run. The dashboard will then be exposed on ```localhost:9092```.


Bringing down the stack
-----------------------
    docker-compose \
    -f docker-compose.client.yml \
    -f docker-compose.girder.yml \
    -f docker-compose.movie.yml \
    -f docker-compose.watch.yml down