# Ingesting Data

## Requirements

Install the `ingest` package

```bash
pip install -e path-to-repo/ingest
```

## Preparing the data

The data is expected to be available in bp files format with a specific file structure before it can be ingested properly. This structure and the file expectations are covered in detail in the [ingest schema](./schema.md) docs. It is recommended that you read those first to set everything up properly.

## Ingest

Once the data has been prepared the script can be run:

```bash
esimmon watch -f <root-folder-id> -r <url-to-data> -k <girder-api-key> -u <girder-api-url> -v 5 -a <fastapi-url>
```

- **`root-folder-id`**: This will be the id of the root folder that was created when you followed the [Ansible](./ansible.md) steps to create the Girder instance.
    1. Navigate to <http://localhost:8080> (or wherever your Girder instance is currently being hosted)
    2. Select `Collections` from the left-hand panel
    3. Select `eSimMon` > `eSimMon-dashboard`
    4. Click the blue `i` icon in the upper right corner

- **`url-to-data`**: This will point to where the data is. This can be either a URL or a local file path. If it is a local file path it should be prefaced with `file:`.

- **`girder-api-key`**: This will vary from user to user.
    1. Navigate to your Girder instance
    2. Select `My Account` from the drop-down menu in the upper right hand corner
    3. Navigate to the `API keys` tab. An API key called `test_key` should have been automatically generated on creation.
        i. If this key is not available select `Create new key`. This only needs to be done once.
        ii. Enter a name for the key and leave the token duration field empty and leave the `Allow all actions on behalf of my user` option selected, the press `Create`.
    4. Select `show` under the key column and then copy the key that is displayed. Keep this information safe and private.

- **`girder-api-url`**: This will be the url of your Girder instance with the prefix `/api/v1` (`http://localhost:8080/api/v1` if running locally).

- **`fastapi-url`**: This will be the url of your FastAPI instance with the prefix `/api/v1` (`http://localhost:5000/api/v1` if running locally). This key is needed to automatically generate and save the default movies for the ingested data once the run is complete.
