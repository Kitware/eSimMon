# Install

```bash
pip install -e <adios-dashboard-repo>/ingest
```

# Run the mock simulation upload site

```bash
adash mock -s 1 -r 1 -i 10 -t 10 -d <path-to-simulation-data>
```

# Run the watch ingester

```bash

adash watch -f <root-folder-id> -r http://localhost:5000 -k <girder-api-key> -u <girder-api-url> -v 5
```
